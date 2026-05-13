// FrameModeIndicator — B37 Phase 1
// Shows current AI/substrate/fallback mode as a corner indicator + colored border
// Per FRAME_MODE_INDICATOR_DESIGN_SPEC_BP025.md

import React from 'react';
import { NotCentsGlyph } from './NotCentsGlyph';

export type FrameMode = 'ai_burst' | 'normal' | 'fallback';

interface FrameModeState {
  mode: FrameMode;
  costRatePerHour?: number;
  estimatedSavings?: number;
  queuedUpgradeAt?: Date;
}

interface FrameModeIndicatorProps {
  state: FrameModeState;
  onModeChange?: (mode: FrameMode) => void;
  showCostControls?: boolean;
  /** Phase 7: cooperative member badge tier ('stamped' shows gold ✦ dot) */
  memberBadge?: 'stamped' | 'ghost';
  /** Phase 7: degraded mode (trial expired) — show grey tint */
  degraded?: boolean;
}

const MODE_META: Record<FrameMode, { icon: string; label: string; tooltip: string }> = {
  ai_burst: {
    icon: '🔥',
    label: 'AI Burst',
    tooltip: 'Full AI synthesis active — substrate + Ollama + cloud',
  },
  normal: {
    icon: '🌿',
    label: 'Normal',
    tooltip: 'Substrate index active — fast retrieval, no AI cost',
  },
  fallback: {
    icon: '🌑',
    label: 'Fallback',
    tooltip: 'Peer-to-peer mode — fully decentralized, zero AI dependency',
  },
};

export const FrameModeIndicator: React.FC<FrameModeIndicatorProps> = ({
  state,
  onModeChange,
  memberBadge,
  degraded = false,
}) => {
  const meta = MODE_META[state.mode];

  const handleClick = () => {
    if (onModeChange) {
      const next: Record<FrameMode, FrameMode> = {
        ai_burst: 'normal',
        normal: 'fallback',
        fallback: 'ai_burst',
      };
      onModeChange(next[state.mode]);
    }
  };

  const effectiveMode = degraded ? 'fallback' : state.mode;
  const effectiveMeta = MODE_META[effectiveMode];

  return (
    <>
      {/* LB Frame border overlay — full-screen; grey when degraded */}
      <div
        className={`lb-frame lb-frame--${degraded ? 'fallback' : state.mode}`}
        aria-hidden="true"
        style={degraded ? { filter: 'grayscale(0.7)', opacity: 0.5 } : undefined}
      />

      {/* §7 BP041 — CAI Đ product-identity stamp (semi-transparent, bottom-right, non-interactive) */}
      <span className="lb-cai-stamp" aria-hidden="true">
        <NotCentsGlyph size="0.9em" alt="" /> CAI
      </span>

      {/* Corner mode indicator — bottom-right */}
      <div
        className={`lb-corner-indicator lb-corner-indicator--${effectiveMode}`}
        title={degraded ? 'Degraded mode — trial expired' : effectiveMeta.tooltip}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label={`Current mode: ${effectiveMeta.label}. Click to cycle.`}
        style={degraded ? { opacity: 0.55, filter: 'grayscale(0.6)' } : undefined}
      >
        <span className="lb-corner-indicator__icon">
          {degraded ? '⚠️' : effectiveMeta.icon}
        </span>
        <span className="lb-corner-indicator__label">
          {degraded ? 'Degraded' : effectiveMeta.label}
        </span>
        {state.mode === 'ai_burst' && state.costRatePerHour !== undefined && !degraded && (
          <span
            className="lb-corner-indicator__label"
            style={{ opacity: 0.7, marginLeft: 2 }}
          >
            ${state.costRatePerHour.toFixed(2)}/hr
          </span>
        )}
        {/* Phase 7: Stamped member gold dot */}
        {memberBadge === 'stamped' && !degraded && (
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#f59e0b',
              marginLeft: 5,
              verticalAlign: 'middle',
              boxShadow: '0 0 4px rgba(245,158,11,0.8)',
            }}
            title="Cooperative member — stamped"
          />
        )}
      </div>
    </>
  );
};

export default FrameModeIndicator;
