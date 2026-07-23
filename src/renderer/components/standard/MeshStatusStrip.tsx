// SEG-K23-B — Compact horizontal mesh health strip (aircraft-instrument style)

import React from 'react';
import { useMeshStatus } from './useMeshStatus';

const STRIP_STYLE: React.CSSProperties = {
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

const SHIMMER_STYLE: React.CSSProperties = {
  ...STRIP_STYLE,
  justifyContent: 'center',
  color: '#707070',
  fontStyle: 'italic',
};

export function MeshStatusStrip(): React.ReactElement {
  const { connected, peerCount, pollAdvancing, frozenPeers, loading } = useMeshStatus();

  if (loading) {
    return <div style={SHIMMER_STYLE}>Connecting...</div>;
  }

  const peerLabel = `${peerCount} peer${peerCount !== 1 ? 's' : ''}`;
  const peerColor = peerCount > 0 ? '#a0a0a0' : connected ? '#f59e0b' : '#a0a0a0';

  return (
    <div style={STRIP_STYLE}>
      <span>
        {connected ? '🟢' : '🔴'} Mesh: {connected ? 'Online' : 'Offline'}
      </span>

      <span style={{ color: peerColor }}>{peerLabel}</span>

      <span style={{ color: pollAdvancing ? '#22c55e' : '#ef4444' }}>
        Poll: {pollAdvancing ? '▶ Active' : '✖ Stalled'}
      </span>

      {frozenPeers.length > 0 && (
        <span
          style={{
            color: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          ⚠ {frozenPeers.length} peer{frozenPeers.length !== 1 ? 's' : ''} may be poll-frozen (
          {frozenPeers.join(', ')})
        </span>
      )}
    </div>
  );
}
