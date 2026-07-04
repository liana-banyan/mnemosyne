// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Guild Incentives Footer
// Sonnet 4.6 · Founder-ratified

import React from 'react';

export function GuildIncentivesFooter() {
  return (
    <div style={s.footer}>
      <h3 style={s.h3}>First-mover advantage</h3>
      <p style={s.p}>
        Name your own chapter. Keep showing up → eligible to{' '}
        <strong style={{ color: '#f0fdf4' }}>vote to rename the Guild itself</strong>.
        Champion an answer that becomes Stone-Tablet canon — you're the{' '}
        <em>champion to beat</em>.
        The earlier you start, the more your contributions compound.
      </p>
      <div style={s.marksTable}>
        <div style={s.tableRow}>
          <span style={s.action}>Connect Discord or Reddit</span>
          <span style={s.marks}>✦ 5 Marks each</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Capture an eblet (per message)</span>
          <span style={s.marks}>✦ 1 Mark</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Eblet upvoted by ≥3 members</span>
          <span style={s.marks}>✦ +3 retroactive</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Install report (verified by 3-voter concordance)</span>
          <span style={s.marks}>✦ +2 Marks</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Community thread captured to Catacombs</span>
          <span style={s.marks}>✦ +3 Marks</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Issue eblet triggers version demotion (κ ≥ 0.85)</span>
          <span style={s.marks}>✦ +10 Marks</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>First to capture a Stone-Tablet answer</span>
          <span style={s.marks}>✦ +25 champion bonus</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Name a chapter (Guild incentive)</span>
          <span style={s.marks}>✦ 50 Marks</span>
        </div>
        <div style={s.tableRow}>
          <span style={s.action}>Vote-success to rename the Guild</span>
          <span style={s.marks}>✦ 250 Marks</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.amplify?.openExternal?.('https://lianabanyan.com/bounty/')}
        style={s.bountyBtn}
      >
        See Bounty Posters →
      </button>
    </div>
  );
}

const s = {
  footer: {
    background: '#060b12',
    border: '1px solid #1e2a38',
    borderRadius: 8,
    padding: '16px 18px',
    marginBottom: 14,
  } as React.CSSProperties,
  h3: {
    margin: '0 0 8px',
    fontSize: 13,
    fontWeight: 700,
    color: '#6ee7b7',
  } as React.CSSProperties,
  p: {
    margin: '0 0 14px',
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.65,
  } as React.CSSProperties,
  marksTable: {
    marginBottom: 14,
  } as React.CSSProperties,
  tableRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid #111827',
    gap: 8,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  action: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
    minWidth: 140,
  } as React.CSSProperties,
  marks: {
    fontSize: 11,
    color: '#6ee7b7',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  bountyBtn: {
    background: 'none',
    border: '1px solid #334155',
    borderRadius: 5,
    color: '#94a3b8',
    fontSize: 11,
    padding: '4px 12px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  } as React.CSSProperties,
};
