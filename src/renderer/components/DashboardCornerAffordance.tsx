// BP048 v0.1.7 B3 — Transparent Outlining Window click-to-Dashboard affordance.
// Overlay is click-through by default; this control captures pointer events locally.

import React, { useCallback } from 'react';

export const DashboardCornerAffordance: React.FC = () => {
  const handleEnter = useCallback(() => {
    window.amplify?.setClickthrough?.(false);
  }, []);

  const handleLeave = useCallback(() => {
    window.amplify?.setClickthrough?.(true);
  }, []);

  const openDashboard = useCallback(() => {
    window.amplify?.setClickthrough?.(false);
    window.amplify?.openDashboard?.();
  }, []);

  return (
    <button
      type="button"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={openDashboard}
      title="Click to open Dashboard"
      aria-label="Open Dashboard"
      className="dashboard-corner-affordance"
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(10, 10, 20, 0.88)',
        border: '1px solid rgba(110,231,183,0.35)',
        borderRadius: 20,
        color: '#6ee7b7',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'NotCents-CAI', 'CAINotCents', system-ui, sans-serif",
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        userSelect: 'none',
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>Ↄ</span>
      <span style={{ fontSize: 11, opacity: 0.9 }}>Dashboard</span>
    </button>
  );
};

export default DashboardCornerAffordance;
