// WelcomeCueCard.tsx -- SEG-R-1 BP067 first-run spine nav card
// Navigation-style card following DeckCuePullup.CueCardItem visual pattern.
// Used in WelcomeView two-doorway cascade (doorway layer + choice layer).

import React from 'react';

export type WelcomeCueCardSize = 'doorway' | 'choice';
export type WelcomeCueCardVariant = 'green' | 'blue' | 'neutral';

export interface WelcomeCueCardProps {
  label: string;
  body?: string;
  size?: WelcomeCueCardSize;
  variant?: WelcomeCueCardVariant;
  onClick: () => void;
}

const VARIANT_STYLES: Record<WelcomeCueCardVariant, {
  border: string;
  bg: string;
  labelColor: string;
  chevronColor: string;
}> = {
  green: {
    border: 'rgba(110, 231, 183, 0.30)',
    bg: 'rgba(6, 78, 59, 0.10)',
    labelColor: '#6ee7b7',
    chevronColor: 'rgba(110, 231, 183, 0.55)',
  },
  blue: {
    border: 'rgba(96, 165, 250, 0.30)',
    bg: 'rgba(30, 64, 175, 0.10)',
    labelColor: '#60a5fa',
    chevronColor: 'rgba(96, 165, 250, 0.55)',
  },
  neutral: {
    border: 'rgba(100, 116, 139, 0.22)',
    bg: 'rgba(15, 23, 42, 0.55)',
    labelColor: '#94a3b8',
    chevronColor: 'rgba(100, 116, 139, 0.50)',
  },
};

export function WelcomeCueCard({
  label,
  body,
  size = 'choice',
  variant = 'green',
  onClick,
}: WelcomeCueCardProps): React.ReactElement {
  const v = VARIANT_STYLES[variant];
  const isDoorway = size === 'doorway';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: isDoorway ? '16px 18px' : '12px 14px',
    background: v.bg,
    border: `1px solid ${v.border}`,
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <button type="button" style={containerStyle} onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isDoorway ? 14 : 12,
          fontWeight: 700,
          color: v.labelColor,
          marginBottom: body ? 4 : 0,
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        {body && (
          <div style={{
            fontSize: 11,
            color: '#64748b',
            lineHeight: 1.6,
          }}>
            {body}
          </div>
        )}
      </div>
      {/* Chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M5.5 3.5L10.5 8L5.5 12.5"
          stroke={v.chevronColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export default WelcomeCueCard;
