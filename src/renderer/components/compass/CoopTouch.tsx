// compass/CoopTouch.tsx -- BP138 Yoke 0.9.14 Phase 4: co-op story placement.
//
// Light, honest "creator-owned co-op" identity touch. Canonical figures ($5/year,
// 83.3% creator-keep) are imported from shared/membership_types.ts, never hardcoded here --
// if that file's canonical values ever change, this banner changes with them automatically
// instead of drifting into a stale, separately-typed number.
//
// Language rule (hard constraint): participation/allocation/back language ONLY. The words
// invest/shares/equity/ROI/securities never appear anywhere in this file, including in
// negated form -- this banner only ever states positively what membership IS, never what it
// is not, so there is no accidental securities-adjacent phrasing to misread.

import React from 'react';
import { MEMBERSHIP_ANNUAL_FEE_USD, CREATOR_KEEP_PERCENT } from '../../../shared/membership_types';

export interface CoopTouchProps {
  onLearnMore: () => void;
  compact?: boolean;
}

export function CoopTouch({ onLearnMore, compact }: CoopTouchProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'rgba(110,231,183,0.05)',
        border: '1px solid rgba(110,231,183,0.18)',
        borderRadius: 8,
        padding: compact ? '8px 12px' : '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap' as const,
      }}
    >
      <span style={{ fontSize: compact ? 14 : 16 }}>🌿</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: compact ? 11 : 12, color: '#94a3b8', lineHeight: 1.5 }}>
          MnemosyneC is built by a members-owned cooperative. For{' '}
          <strong style={{ color: '#6ee7b7' }}>${MEMBERSHIP_ANNUAL_FEE_USD}/year</strong>, you
          become a member and share in how the cooperative allocates what it earns back to the
          people who build and use it -- Workers, Builders, and Creators keep{' '}
          <strong style={{ color: '#6ee7b7' }}>{CREATOR_KEEP_PERCENT}%</strong>.
        </div>
      </div>
      <button
        onClick={onLearnMore}
        style={{
          background: 'none',
          border: '1px solid rgba(110,231,183,0.3)',
          borderRadius: 6,
          color: '#6ee7b7',
          fontSize: 11,
          fontWeight: 600,
          padding: '4px 10px',
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap' as const,
        }}
      >
        About membership →
      </button>
    </div>
  );
}

export default CoopTouch;
