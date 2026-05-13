// BP041 SAGA 3 — Mode Selector Popover
// Replaces read-only "AI Burst" label with a clickable 3-mode selector.
//
// Three modes (Fire / Hearth / Cool) — Founder direct BP041:
//   "user should be able to click it and choose which of the three to use."
//
// Canon: project_mnemosyne_mode_selector_and_ollama_bundling_bp041.md
// Brick Wall: R16 NO-API-KEY-EXPOSURE · R17 SHOW-RESULTS · R18 R-FOREMAN-FIRST
//             NO-FIAT-CONVERSION (mode selector makes cost visible at glance)
//             AGPL Free Forever · 8-dim accessibility (aria-labels, keyboard)

import React, { useCallback, useEffect, useRef } from 'react';
import type { FrameMode } from './FrameModeIndicator';

interface ModeOption {
  mode: FrameMode;
  icon: string;
  label: string;    // member-facing name (Fire / Hearth / Cool)
  stack: string;    // what runs
  cost: string;     // cost signal
  prereq: string;   // prerequisite check
  prereqMet: boolean;
}

interface ModeSelectorPopoverProps {
  currentMode: FrameMode;
  onSelect: (mode: FrameMode) => void;
  onClose: () => void;
  /** Whether an Ollama instance is detected locally */
  ollamaAvailable?: boolean;
  /** Whether the ANTHROPIC_API_KEY is configured */
  apiKeyAvailable?: boolean;
}

export const ModeSelectorPopover: React.FC<ModeSelectorPopoverProps> = ({
  currentMode,
  onSelect,
  onClose,
  ollamaAvailable = false,
  apiKeyAvailable = false,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState<FrameMode>(currentMode);

  // Mode definitions — names and colors per color+dash accessibility canon
  const modes: ModeOption[] = [
    {
      mode: 'ai_burst',
      icon: '🔥',
      label: 'Fire',
      stack: 'Cloud AI + Hearth + Substrate',
      cost: 'Pay-per-token (~$0.054/artifact)',
      prereq: 'Requires ANTHROPIC_API_KEY',
      prereqMet: apiKeyAvailable,
    },
    {
      mode: 'normal',
      icon: '🪵',
      label: 'Hearth',
      stack: 'Local Ollama + Substrate',
      cost: 'Zero marginal (after Ollama install)',
      prereq: 'Requires Ollama installed',
      prereqMet: ollamaAvailable,
    },
    {
      mode: 'fallback',
      icon: '❄️',
      label: 'Cool',
      stack: 'Substrate cache only',
      cost: 'Zero — always. Offline-capable.',
      prereq: 'Always available',
      prereqMet: true,
    },
  ];

  // Mode colors mirror the triple-channel CSS accessibility spec
  const modeColors: Record<FrameMode, { primary: string; bg: string; border: string }> = {
    ai_burst: { primary: '#facc15', bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.45)' },
    normal:   { primary: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',  border: 'rgba(34, 197, 94, 0.45)'  },
    fallback: { primary: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.45)' },
  };

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [onClose]);

  // Focus trap: keep focus inside popover
  useEffect(() => {
    const firstBtn = popoverRef.current?.querySelector('button');
    (firstBtn as HTMLElement | null)?.focus();
  }, []);

  const handleApply = useCallback(() => {
    if (selected !== currentMode) {
      onSelect(selected);
    }
    onClose();
  }, [selected, currentMode, onSelect, onClose]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose Mnemosyne substrate mode"
      style={styles.overlay}
    >
      <div style={styles.popover}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>Choose substrate mode</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close mode selector"
            title="Close (Esc)"
          >✕</button>
        </div>

        {/* Mode rows */}
        <div style={styles.modeList} role="radiogroup" aria-label="Substrate modes">
          {modes.map((opt) => {
            const isSelected = selected === opt.mode;
            const colors = modeColors[opt.mode];
            return (
              <button
                key={opt.mode}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={!opt.prereqMet}
                disabled={!opt.prereqMet}
                onClick={() => opt.prereqMet && setSelected(opt.mode)}
                style={{
                  ...styles.modeRow,
                  background: isSelected ? colors.bg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? colors.border : 'rgba(255,255,255,0.1)'}`,
                  opacity: opt.prereqMet ? 1 : 0.45,
                  cursor: opt.prereqMet ? 'pointer' : 'not-allowed',
                }}
                title={opt.prereqMet ? `Select ${opt.label} mode` : `${opt.prereq} — unavailable`}
              >
                {/* Mode icon + name */}
                <div style={styles.modeLeft}>
                  <span style={{ fontSize: 20 }}>{opt.icon}</span>
                  <div style={styles.modeInfo}>
                    <span style={{ ...styles.modeLabel, color: isSelected ? colors.primary : 'rgba(255,255,255,0.85)' }}>
                      {opt.label}
                    </span>
                    <span style={styles.modeStack}>{opt.stack}</span>
                    <span style={{ ...styles.modeCost, color: opt.prereqMet ? 'rgba(255,255,255,0.5)' : '#f87171' }}>
                      {opt.prereqMet ? opt.cost : `⚠ ${opt.prereq}`}
                    </span>
                  </div>
                </div>
                {/* Selection indicator */}
                <div style={{
                  ...styles.radioIndicator,
                  borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.25)',
                  background: isSelected ? colors.primary : 'transparent',
                }} />
              </button>
            );
          })}
        </div>

        {/* Footer: Cancel / Apply */}
        <div style={styles.footer}>
          <button
            style={styles.cancelBtn}
            onClick={onClose}
            aria-label="Cancel — keep current mode"
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.applyBtn,
              background: modeColors[selected].bg,
              borderColor: modeColors[selected].border,
              color: modeColors[selected].primary,
            }}
            onClick={handleApply}
            aria-label={`Apply ${modes.find(m => m.mode === selected)?.label ?? selected} mode`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 12,
  },
  popover: {
    background: '#0f111a',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    width: 340,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
    borderRadius: 4,
    lineHeight: 1,
  },
  modeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
  },
  modeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 7,
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.15s ease, border-color 0.15s ease',
    fontFamily: 'inherit',
  },
  modeLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  modeInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  modeStack: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.3,
  },
  modeCost: {
    fontSize: 10,
    lineHeight: 1.3,
  },
  radioIndicator: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid',
    flexShrink: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  footer: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)',
    padding: '7px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  applyBtn: {
    border: '1px solid',
    padding: '7px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
  },
};

export default ModeSelectorPopover;
