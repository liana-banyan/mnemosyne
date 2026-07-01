// SEG-K23-D — Bounty poster card component

import React from 'react';

export interface BountyPosterProps {
  posterId: string;
  headline: string;
  whatIsNeeded: string;
  whyItMatters: string;
  memberGets: string;
  onClaim: (posterId: string) => void;
  claimLabel?: string;
}

const CARD_STYLE: React.CSSProperties = {
  width: 280,
  padding: 16,
  backgroundColor: 'rgba(30, 40, 50, 0.8)',
  border: '1px solid rgba(100, 200, 150, 0.3)',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: '#7a9b8a',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 2,
};

const TEXT_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#a0b0a8',
  lineHeight: 1.5,
  margin: 0,
};

export function BountyPoster(props: BountyPosterProps) {
  const { posterId, headline, whatIsNeeded, whyItMatters, memberGets, onClaim, claimLabel = 'TAKE THE WHEEL →' } = props;

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#8bc8a0', lineHeight: 1.4 }}>
        {headline}
      </div>

      <div>
        <div style={LABEL_STYLE}>What&apos;s Needed</div>
        <p style={TEXT_STYLE}>{whatIsNeeded}</p>
      </div>

      <div>
        <div style={LABEL_STYLE}>Why It Matters</div>
        <p style={TEXT_STYLE}>{whyItMatters}</p>
      </div>

      <div>
        <div style={LABEL_STYLE}>What You Get</div>
        <p style={TEXT_STYLE}>{memberGets}</p>
      </div>

      <button
        type="button"
        onClick={() => onClaim(posterId)}
        style={{
          marginTop: 4,
          padding: '8px 14px',
          backgroundColor: 'rgba(100, 200, 150, 0.15)',
          border: '1px solid rgba(100, 200, 150, 0.5)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {claimLabel}
      </button>
    </div>
  );
}
