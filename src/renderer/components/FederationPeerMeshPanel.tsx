// Mnemosyne — Federation Peer Mesh Panel
// MV-CN Cross-Network Mesh · SAGA 3 BP045 W1
//
// Surfaces discovered peers (LAN + WAN relay), their handshake phase,
// and the relay connection status. Mounts inside HearthConjunctionWindow
// or the AMPLIFY Dashboard (wired via IPC).

import React, { useEffect, useState, useCallback } from 'react';
import type { MnemosynePeer, PeerPhase } from '../../shared/federation-protocol';

// ─── IPC types ────────────────────────────────────────────────────────────────

interface MeshState {
  peers: MnemosynePeer[];
  relayConnected: boolean;
  ownPeerId: string;
}

// ─── Phase badge ──────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<PeerPhase, string> = {
  discovered: '#f59e0b',
  identified: '#60a5fa',
  ratified:   '#a78bfa',
  synced:     '#22c55e',
  error:      '#ef4444',
};

const PHASE_LABEL: Record<PeerPhase, string> = {
  discovered: 'Discovered',
  identified: 'Identified',
  ratified:   'Ratified',
  synced:     'Synced ✓',
  error:      'Error',
};

function PhaseBadge({ phase }: { phase: PeerPhase }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 7px',
      borderRadius: 10,
      background: PHASE_COLOR[phase] + '22',
      color: PHASE_COLOR[phase],
      border: `1px solid ${PHASE_COLOR[phase]}55`,
      letterSpacing: '0.03em',
      textTransform: 'uppercase' as const,
    }}>
      {PHASE_LABEL[phase]}
    </span>
  );
}

// ─── Peer row ─────────────────────────────────────────────────────────────────

function PeerRow({ peer }: { peer: MnemosynePeer }) {
  const transportLabel = peer.transport === 'lan' ? '🔵 LAN' : '🌐 WAN';
  const ago = Math.round((Date.now() - new Date(peer.lastSeen).getTime()) / 1000);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      marginBottom: 6,
      gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
          {peer.displayName ?? peer.peerId.slice(0, 8) + '…'}
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {transportLabel} · {peer.address === 'relay' ? 'via relay' : peer.address}
          {' · '}seen {ago}s ago
        </div>
      </div>
      <PhaseBadge phase={peer.phase} />
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FederationPeerMeshPanel() {
  const [meshState, setMeshState] = useState<MeshState>({
    peers: [],
    relayConnected: false,
    ownPeerId: '',
  });
  const [loading, setLoading] = useState(true);

  const loadMesh = useCallback(async () => {
    try {
      const state = await (window as any).amplify?.getMeshState?.();
      if (state) setMeshState(state);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMesh();
    const iv = setInterval(loadMesh, 5000);

    const cleanup1 = (window as any).amplify?.onMeshStateChanged?.((state: MeshState) => {
      setMeshState(state);
    });
    const cleanup2 = (window as any).amplify?.onRelayStateChanged?.((s: { relayConnected: boolean }) => {
      setMeshState((prev) => ({ ...prev, ...s }));
    });

    return () => {
      clearInterval(iv);
      cleanup1?.();
      cleanup2?.();
    };
  }, [loadMesh]);

  const lanPeers = meshState.peers.filter((p) => p.transport === 'lan');
  const wanPeers = meshState.peers.filter((p) => p.transport === 'wan-relay');
  const syncedCount = meshState.peers.filter((p) => p.phase === 'synced').length;

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e2e8f0',
      minWidth: 280,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
          Peer Mesh
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: meshState.relayConnected ? '#22c55e' : '#475569',
          }} />
          <span style={{ fontSize: 10, color: meshState.relayConnected ? '#22c55e' : '#475569' }}>
            {meshState.relayConnected ? 'Relay connected' : 'Relay offline'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 14,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {[
          { label: 'Total', value: meshState.peers.length },
          { label: 'LAN', value: lanPeers.length },
          { label: 'WAN', value: wanPeers.length },
          { label: 'Synced', value: syncedCount, highlight: syncedCount > 0 },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' as const }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? '#22c55e' : '#94a3b8' }}>{value}</div>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Own peer ID */}
      {meshState.ownPeerId && (
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>
          My peer ID: <span style={{ color: '#475569', fontFamily: 'monospace' }}>{meshState.ownPeerId}</span>
        </div>
      )}

      {/* Peer list */}
      {loading ? (
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: 12 }}>Scanning…</div>
      ) : meshState.peers.length === 0 ? (
        <div style={{
          fontSize: 11, color: '#334155', textAlign: 'center', padding: 16,
          border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 8,
        }}>
          No peers discovered yet.<br />
          <span style={{ color: '#475569' }}>Other Mnemosyne instances on your network<br />will appear here automatically.</span>
        </div>
      ) : (
        <>
          {lanPeers.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔵 Local Network
              </div>
              {lanPeers.map((p) => <PeerRow key={p.peerId} peer={p} />)}
            </>
          )}
          {wanPeers.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🌐 Cross-Network (relay)
              </div>
              {wanPeers.map((p) => <PeerRow key={p.peerId} peer={p} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}
