// compass/ProofTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 2 (Proof).
// BP140-K5: run controls relocated here from Power/Diagnostics (see MOVE 1 in the K5 dispatch)
// -- the Founder wants to be able to run the Sourced-Knowledge Benchmark right where its proof
// lives, not hunt for it under More > Power. No new component was built for this: the SAME
// OneClickMeshTestPanel.tsx (its own IPC handlers, its own run-controls checkboxes, its own
// live-progress feed, its own results view + Coroner autopsy) is now mounted here instead of in
// PowerDiagnosticsPanel.tsx -- a placement change, not a rewrite. See PowerDiagnosticsPanel.tsx's
// header for the corresponding removal note.
//
// Composes, all reused as-is (no rebuild):
//  - ProveItWorksTab.tsx (real Answer-Cache Meter + poller health check + the Browser Authority
//    panel, whose sign-in rows are interactive enable toggles bound to the existing
//    authorityEnabled/mnem_drt_specialists state -- "third-party proofs" in miniature: every
//    number here comes from a persisted per-query JSONL log or a live IPC probe).
//  - OneClickMeshTestPanel.tsx, directly under Test Authority -- the FULL Sourced-Knowledge
//    Benchmark surface: run controls (Substrate context, 12-Blade Column Plow, Andon retry loop,
//    Research Arm, Mesh Synergy, Decompose+Eliminate, Federated substrate, question-count,
//    HOT/COLD Lift), its live per-question progress feed, the shared MeshTestResultSummary
//    results view (aggregate accuracy, per-peer breakdown, mesh consensus, downloadable
//    receipt, "Share your results"), and the Answer Coroner autopsy panel. A new user now sees
//    the run controls the first time they land here -- that tradeoff (vs. the prior "never show
//    a mesh-toggle wall" stance) is the explicit point of this relocation.
//
// Honest gap (documented in the Yoke final report too): if no benchmark has ever been run on
// this machine, OneClickMeshTestPanel's own internal empty state (no `result` yet) covers it --
// no fabricated number, no separate placeholder needed here anymore.

import React from 'react';
import { ProveItWorksTab } from '../standard/ProveItWorksTab';
import { OneClickMeshTestPanel } from '../OneClickMeshTestPanel';
import type { CompassNavigate } from './types';
import type { AuthState } from '../../amplify.d';

export interface ProofTabProps {
  onNavigate: CompassNavigate;
  authState: AuthState | null;
}

export function ProofTab({ onNavigate, authState }: ProofTabProps): React.ReactElement {
  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '16px 20px',
      background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }}>Proof</div>
      <div style={{ marginBottom: 16, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
        Third-party proofs, benchmark results, and provenance -- nothing here is a reasoning
        claim; every number is either a real counter from this machine's own log, or a receipt
        from a named independent source.
      </div>

      {/* ProveItWorksTab's onSwitchTab always calls back with 'ask' (see its own footer
          button) -- the param is ignored here since Proof only ever routes it to Compass's
          Ask tab, not an arbitrary string. Its own last section is the Test Authority /
          Browser Authority panel -- OneClickMeshTestPanel is mounted immediately below it,
          per the BP140-K5 MOVE 1 placement (run controls now directly under Test Authority). */}
      <ProveItWorksTab onSwitchTab={() => onNavigate('ask')} />

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        Sourced-Knowledge Benchmark -- run controls + results
      </div>

      {/* BP140-K5 MOVE 1: relocated verbatim from PowerDiagnosticsPanel.tsx -- same component,
          same props, same 'mnemo-jump-to-social' cross-tab share wiring (CompassShell.tsx
          listens for that DOM CustomEvent globally, so it still works from this new mount
          point with zero changes to the event contract). */}
      <OneClickMeshTestPanel
        authState={authState}
        onShareResult={() => { window.dispatchEvent(new CustomEvent('mnemo-jump-to-social')); }}
      />
    </div>
  );
}

export default ProofTab;
