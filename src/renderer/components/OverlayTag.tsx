// BP041 SAGA 3 — Transparency Watch View: OverlayTag
//
// The small persistent tag visible when Mnemosyne is in Watch View (overlay-only mode).
// Member clicks it to expand back to the full Configure View.
//
// Founder direct (BP041): "switch to the transparent view … so that you can load
// Mnemosyne, choose what you like, then SWITCH TO NORMAL VIEW (which is transparency
// and just the outline, and the toggle as maybe a tag the size of the NotCents
// Mnemosyne button I outlined in Green)."
//
// Two views:
//   Configure View (default) — full Mnemosyne window open
//   Watch View               — full window hidden; only this tag + frame border visible
//
// Keyboard shortcut: Ctrl+Shift+M toggles between views (wired in main index.ts).
// Canon: project_mnemosyne_bp041_post_first_fire_design_vision.md §2
// BLOOD RULE binding: Watch View must NEVER leak member data outside Mnemosyne window.

import React, { useEffect } from 'react';
import type { FrameMode } from './FrameModeIndicator';
import { NotCentsGlyph } from './NotCentsGlyph';

interface OverlayTagProps {
  /** Current substrate mode — used for tag accent color */
  mode?: FrameMode;
  /** Called when member clicks the tag (open Mnemosyne window) */
  onExpand: () => void;
}

const MODE_COLOR: Record<FrameMode, string> = {
  ai_burst: '#facc15',
  normal:   '#22c55e',
  fallback: '#3b82f6',
};

export const OverlayTag: React.FC<OverlayTagProps> = ({
  mode = 'fallback',
  onExpand,
}) => {
  const accentColor = MODE_COLOR[mode];

  // Keyboard shortcut: Ctrl+Shift+M → expand
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        onExpand();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExpand]);

  const handleOpen = () => {
    window.amplify?.openDashboard?.();
    onExpand();
  };

  return (
    <button
      onClick={handleOpen}
      title="Click to open Dashboard"
      aria-label="Click to open Dashboard"
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        background: 'rgba(10, 10, 20, 0.82)',
        border: `1px solid ${accentColor}55`,
        borderRadius: 20,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        cursor: 'pointer',
        zIndex: 99998,
        backdropFilter: 'blur(6px)',
        boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}22`,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        userSelect: 'none',
      }}
    >
      <NotCentsGlyph size="0.95em" alt="" style={{ color: accentColor }} />
      <span style={{ color: accentColor }}>Mnemosyne</span>
      <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>⌨ M</span>
    </button>
  );
};

export default OverlayTag;
