// compass/PowerDiagnosticsPanel.tsx -- BP138 Yoke 0.9.14: Phase 2 (Power/Diagnostics, under
// More).
//
// Scoped EXACTLY to the already-live OneClickMeshTestPanel.tsx controls, per Founder decision
// #2 (reconfirmed in-session): the unrouted TestItOutTab.tsx ("Plow the Field") /
// BenchmarkModal.tsx ("Beat-Google Benchmark") surface is NOT resurrected here, and is NOT
// folded into Proof either -- both files are left completely untouched and unrouted. That
// surface is flagged only as a candidate to evaluate for Proof in a LATER build (see this
// Yoke's final report, open questions).
//
// Composes (all reused as-is, relocated not duplicated):
//  - LeanFederationPanel (from LeanGauntletTab.tsx) -- peer scan, same collapsible-toggle
//    pattern the old Package Store tab used.
//  - OneClickMeshTestPanel -- full component (run controls + its own live/complete result
//    view via the now-shared MeshTestResultSummary). New users never see this because it is
//    reachable ONLY through More -> Power, never from Ask/Proof/Library/Social/the Ask home.
//  - Substrate (Tools & Panels / Stats / Console) -- moved here per the Founder's explicit
//    "Substrate stays out of Library, moves to Power/More as internal/advanced vocabulary"
//    decision. Mirrors CleanShell.tsx's CombinedSubstrateTab sub-tab pattern exactly, but is
//    its own small local composer (not an import from CleanShell.tsx) so the existing
//    '#/clean-shell' fork's file is never touched by this Yoke.

import React, { useState } from 'react';
import type { AuthState } from '../../amplify.d';
import { LeanFederationPanel } from '../LeanGauntletTab';
import { OneClickMeshTestPanel } from '../OneClickMeshTestPanel';
import { SubstrateTab } from '../SubstrateTab';
import { SubstrateStatsTab } from '../SubstrateStatsTab';
import { UnifiedSubstrateConsole } from '../UnifiedSubstrateConsole';

type SubstrateSubView = 'panels' | 'stats' | 'console';

function SubstrateComposer(): React.ReactElement {
  const [sub, setSub] = useState<SubstrateSubView>('panels');
  return (
    <div style={{ border: '1px solid #1e2a38', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0', background: '#0d1117' }}>
        {(['panels', 'stats', 'console'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{
              background: 'none', border: 'none',
              color: sub === id ? '#f0fdf4' : '#64748b',
              fontSize: 12, fontWeight: sub === id ? 700 : 400,
              padding: '4px 10px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              borderBottom: sub === id ? '2px solid #6ee7b7' : '2px solid transparent',
            }}
          >
            {id === 'panels' ? 'Tools & Panels' : id === 'stats' ? '📊 Stats' : '🌉 Console'}
          </button>
        ))}
      </div>
      <div style={{ height: 420 }}>
        {sub === 'panels' && <SubstrateTab />}
        {sub === 'stats' && <SubstrateStatsTab />}
        {sub === 'console' && <UnifiedSubstrateConsole />}
      </div>
    </div>
  );
}

export interface PowerDiagnosticsPanelProps {
  authState: AuthState | null;
}

export function PowerDiagnosticsPanel({ authState }: PowerDiagnosticsPanelProps): React.ReactElement {
  const [showPeerScan, setShowPeerScan] = useState(false);
  const [showSubstrate, setShowSubstrate] = useState(false);

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '16px 20px',
      background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }}>Power / Diagnostics</div>
      <div style={{ marginBottom: 16, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
        Advanced, internal controls -- mesh dispatch, the raw benchmark run-controls, and
        substrate internals. Not part of the new-user product promise; that's why this lives
        only here, under More.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <button onClick={() => setShowPeerScan((v) => !v)} style={pillBtn(showPeerScan)}>
          ⬡ {showPeerScan ? 'Hide' : 'Scan for Peers'}
        </button>
        <button onClick={() => setShowSubstrate((v) => !v)} style={pillBtn(showSubstrate)}>
          🧬 {showSubstrate ? 'Hide' : 'Substrate'}
        </button>
      </div>

      {showPeerScan && (
        <div style={{ marginBottom: 16 }}>
          <LeanFederationPanel />
        </div>
      )}

      {showSubstrate && (
        <div style={{ marginBottom: 16 }}>
          <SubstrateComposer />
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        Sourced-Knowledge Benchmark -- run controls
      </div>
      {/* Reuses the exact same cross-tab jump wiring as the old Package Store tab
          (CleanShell.tsx:148/378-385) -- CompassShell listens for this same
          'mnemo-jump-to-social' DOM CustomEvent and switches to the Social tab. */}
      <OneClickMeshTestPanel
        authState={authState}
        onShareResult={() => { window.dispatchEvent(new CustomEvent('mnemo-jump-to-social')); }}
      />
    </div>
  );
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#1e3a5c' : 'none',
    color: active ? '#e2e8f0' : '#6ee7b7',
    border: '1px solid #1e4038',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  };
}

export default PowerDiagnosticsPanel;
