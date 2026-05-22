// P2P Discovery Panel — Mnemosyne™ v0.1.8 · SEG-FT-3 · BP052 NOVACULA
// LAN peer discovery status panel — no cloud relay.

import React, { useState, useEffect, useCallback } from 'react';
import type { P2PDiscoveryPeer } from '../../shared/kitchen_table_types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function P2PDiscoveryPanel() {
  const [peers, setPeers] = useState<P2PDiscoveryPeer[]>([]);
  const [active, setActive] = useState(false);
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await (window.amplify as any)?.kitchenTable?.p2pPeers?.() as { peers: P2PDiscoveryPeer[]; active: boolean } | null;
      if (result) {
        setPeers(result.peers ?? []);
        setActive(result.active ?? false);
      }
    } catch {
      // IPC unavailable
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => { void refresh(); }, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleToggle() {
    setToggling(true);
    try {
      if (active) {
        await (window.amplify as any)?.kitchenTable?.p2pStop?.();
        setActive(false);
        setPeers([]);
      } else {
        const peerId = localStorage.getItem('mnemo_peer_id') ?? Math.random().toString(36).slice(2);
        localStorage.setItem('mnemo_peer_id', peerId);
        const displayName = localStorage.getItem('mnemo_display_name') ?? 'Mnemosyne™';
        await (window.amplify as any)?.kitchenTable?.p2pStart?.(peerId, displayName);
        setActive(true);
        setTimeout(() => { void refresh(); }, 2000);
      }
    } catch {
      // IPC unavailable
    } finally {
      setToggling(false);
    }
  }

  const capColor: Record<string, string> = {
    kitchen_table: '#6ee7b7',
    atlas: '#38bdf8',
  };

  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)',
      border: '1px solid rgba(100,116,139,0.15)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {active && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 6px #22c55e',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} title="Discovery active" />
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#e2e8f0' : '#64748b' }}>
            {active ? 'Discovery Active' : 'Discovery Off'}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            · {peers.length} peer{peers.length !== 1 ? 's' : ''} found
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            cursor: toggling ? 'wait' : 'pointer',
            border: active ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(110,231,183,0.3)',
            background: active ? 'rgba(248,113,113,0.06)' : 'rgba(110,231,183,0.06)',
            color: active ? '#f87171' : '#6ee7b7',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          {toggling ? '…' : active ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Peer list */}
      {peers.length === 0 && active && (
        <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', padding: '8px 0' }}>
          Listening for peers on LAN — no peers found yet
        </div>
      )}
      {peers.length === 0 && !active && (
        <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', padding: '8px 0' }}>
          Start discovery to find other Mnemosyne™ instances on your network
        </div>
      )}
      {peers.map((peer) => (
        <div key={peer.peerId} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 0', borderBottom: '1px solid rgba(100,116,139,0.08)',
          gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{peer.displayName}</div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
              {relativeTime(peer.lastSeen)} · {peer.trustLevel}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {peer.capabilities.map((cap) => (
              <span key={cap} style={{
                fontSize: 8, borderRadius: 8, padding: '1px 5px',
                border: `1px solid ${capColor[cap] ?? '#64748b'}20`,
                color: capColor[cap] ?? '#64748b',
                background: `${capColor[cap] ?? '#64748b'}0d`,
              }}>
                {cap}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
