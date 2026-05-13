// FrameModeIndicator — B37 Phase 1
// BP041 SAGA 3: corner stamp is now a clickable mode selector (Fire/Hearth/Cool).
//
// Per FRAME_MODE_INDICATOR_DESIGN_SPEC_BP025.md + project_mnemosyne_mode_selector_bp041.md
// Mode triple-channel accessibility: hue + luminance + border-dash-pattern (BP041 canon).
//
// Founder direct: "user should be able to click it and choose which of the three to use."
// Brick Wall: NO-FIAT-CONVERSION (mode = cost visibility) · AGPL · 8-dim accessibility.

import React, { useState, useCallback } from 'react';
import { NotCentsGlyph } from './NotCentsGlyph';
import { ModeSelectorPopover } from './ModeSelectorPopover';

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
  /** Phase 7: cooperative member badge tier ('stamped' shows gold dot) */
  memberBadge?: 'stamped' | 'ghost';
  /** Phase 7: degraded mode (trial expired) — show grey tint */
  degraded?: boolean;
  /** Whether Ollama is currently running (prerequisite for Hearth mode) */
  ollamaAvailable?: boolean;
  /** Whether an API key is configured (prerequisite for Fire mode) */
  apiKeyAvailable?: boolean;
}

// Member-facing mode labels: Fire / Hearth / Cool (BP041 SAGA 3 canon)
// Internal keys preserve compatibility: ai_burst / normal / fallback
const MODE_META: Record<FrameMode, {
  icon: string;
  label: string;    // member-facing Fire/Hearth/Cool
  tooltip: string;
  color: string;    // triple-channel primary color
}> = {
  ai_burst: {
    icon: '🔥',
    label: 'Fire',
    tooltip: 'Fire mode — Cloud AI + Hearth + Substrate. Pay-per-token.',
    color: '#facc15',
  },
  normal: {
    icon: '🪵',
    label: 'Hearth',
    tooltip: 'Hearth mode — Local Ollama + Substrate. Zero marginal cost.',
    color: '#22c55e',
  },
  fallback: {
    icon: '❄️',
    label: 'Cool',
    tooltip: 'Cool mode — Substrate cache only. Zero cost. Offline-capable.',
    color: '#3b82f6',
  },
};

export const FrameModeIndicator: React.FC<FrameModeIndicatorProps> = ({
  state,
  onModeChange,
  memberBadge,
  degraded = false,
  ollamaAvailable = false,
  apiKeyAvailable = false,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const effectiveMode = degraded ? 'fallback' : state.mode;
  const meta = MODE_META[effectiveMode];

  const handleClick = useCallback(() => {
    if (degraded) return;
    setPopoverOpen(true);
  }, [degraded]);

  const handleModeSelect = useCallback((mode: FrameMode) => {
    onModeChange?.(mode);
    setPopoverOpen(false);
    // Persist choice via IPC (forceFrameMode exists in preload)
    try {
      window.amplify?.forceFrameMode?.(mode).catch(() => {/* non-fatal */});
    } catch { /* non-fatal if IPC not wired */ }
  }, [onModeChange]);

  return (
    <>
      {/* LB Frame border overlay — full-screen; grey when degraded */}
      <div
        className={`lb-frame lb-frame--${degraded ? 'fallback' : state.mode}`}
        aria-hidden="true"
        style={degraded ? { filter: 'grayscale(0.7)', opacity: 0.5 } : undefined}
      />

      {/* §7 BP041 — CAI NotCents product-identity stamp (bottom-right, non-interactive) */}
      <span className="lb-cai-stamp" aria-hidden="true">
        <NotCentsGlyph size="0.9em" alt="" /> CAI
      </span>

      {/* Corner mode indicator — bottom-right; clickable to open mode selector */}
      <div
        className={`lb-corner-indicator lb-corner-indicator--${effectiveMode}`}
        title={degraded ? 'Degraded mode — trial expired' : meta.tooltip}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        aria-label={`Current mode: ${meta.label}. Click to change mode.`}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        style={degraded ? { opacity: 0.55, filter: 'grayscale(0.6)', cursor: 'not-allowed' } : { cursor: 'pointer' }}
      >
        <span className="lb-corner-indicator__icon">
          {degraded ? '⚠️' : meta.icon}
        </span>
        <span className="lb-corner-indicator__label" style={{ color: degraded ? undefined : meta.color }}>
          {degraded ? 'Degraded' : meta.label}
        </span>
        {state.mode === 'ai_burst' && state.costRatePerHour !== undefined && !degraded && (
          <span
            className="lb-corner-indicator__label"
            style={{ opacity: 0.7, marginLeft: 2, fontSize: '0.8em' }}
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

      {/* Mode Selector Popover — opens when member clicks the corner indicator */}
      {popoverOpen && !degraded && (
        <ModeSelectorPopover
          currentMode={state.mode}
          onSelect={handleModeSelect}
          onClose={() => setPopoverOpen(false)}
          ollamaAvailable={ollamaAvailable}
          apiKeyAvailable={apiKeyAvailable}
        />
      )}
    </>
  );
};

export default FrameModeIndicator;
