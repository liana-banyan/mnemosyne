// compass/ProofTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 2 (Proof).
//
// Composes, all reused as-is (no rebuild):
//  - ProveItWorksTab.tsx (real Answer-Cache Meter + poller health check -- "third-party
//    proofs" in miniature: every number here comes from a persisted per-query JSONL log).
//  - MeshTestResultSummary (extracted from OneClickMeshTestPanel.tsx this same Yoke, see that
//    file's header) -- the Sourced-Knowledge Benchmark's RESULTS ONLY (aggregate accuracy,
//    per-peer breakdown, mesh consensus, downloadable full receipt, and -- with
//    showPerQuestionDetail -- the per-question "how this answer was assembled" provenance
//    list). The run CONTROLS (mode picker, WAN Mesh, 12-Blade Plow, Research Arm, Mesh
//    Synergy, HOT/COLD Lift) stay in Power/Diagnostics (Phase 2, under More) -- this tab never
//    renders them, so a new user lands here without ever seeing a mesh-toggle wall.
//  - A Phase 5 "Share this proof" Cue Deck card, gated on a real persisted benchmark result.
//
// Honest gap (documented in the Yoke final report too): if no benchmark has ever been run on
// this machine, this tab shows an explicit empty state pointing at Power/Diagnostics rather
// than a fabricated number.

import React, { useEffect, useState } from 'react';
import { ProveItWorksTab } from '../standard/ProveItWorksTab';
import { MeshTestResultSummary, loadLastMeshTestResult, type OneClickRunResult } from '../OneClickMeshTestPanel';
import { CueDeckCardRenderer, type CueCardTemplate } from '../CueDeckCardRenderer';
import type { CompassNavigate } from './types';

export interface ProofTabProps {
  onNavigate: CompassNavigate;
}

export function ProofTab({ onNavigate }: ProofTabProps): React.ReactElement {
  const [result, setResult] = useState<OneClickRunResult | null>(() => loadLastMeshTestResult());
  const [shareOpen, setShareOpen] = useState(false);

  // Refresh when the tab regains focus (e.g. a benchmark run finished in Power/Diagnostics
  // while this tab was mounted in the background) -- same convention SocialTab.tsx uses for
  // its own "Check My Math" card.
  useEffect(() => {
    const onFocus = () => setResult(loadLastMeshTestResult());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const shareTemplate: CueCardTemplate | null = result ? {
    id: 'doctrine-proof-share',
    title: 'See My Proof',
    subtitle: 'Sourced-Knowledge Benchmark -- real, provenance-backed result',
    body_text: result.dispatchMode === 'wan_mesh'
      ? `Dispatched across ${result.livePeersFound ?? '?'} live WAN mesh peer(s): ${result.correct}/${result.scored} correct. ${result.datasetLabel}`
      : `Dispatched locally on this machine: ${result.correct}/${result.scored} correct. ${result.datasetLabel}`,
    accent_color: 'secondary',
    background_type: 'gradient',
  } : null;

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
          Ask tab, not an arbitrary string. */}
      <ProveItWorksTab onSwitchTab={() => onNavigate('ask')} />

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        Sourced-Knowledge Benchmark -- results
      </div>

      {result ? (
        <>
          <MeshTestResultSummary result={result} showPerQuestionDetail />
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShareOpen((v) => !v)} style={{
              background: 'none', color: '#6ee7b7', border: '1px solid #1e4038', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}>
              📤 {shareOpen ? 'Hide share card' : 'Share this proof'}
            </button>
            {shareOpen && shareTemplate && (
              <div style={{ marginTop: 10 }}>
                <CueDeckCardRenderer template={shareTemplate} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{
          fontSize: 12, color: '#475569', fontStyle: 'italic',
          background: '#111827', border: '1px solid #1e2a38', borderRadius: 8, padding: '14px 16px',
        }}>
          No benchmark run yet on this machine -- honestly empty, not a placeholder number. Run
          the Sourced-Knowledge Benchmark from{' '}
          <button
            onClick={() => onNavigate('more', 'power')}
            style={{ background: 'none', border: 'none', color: '#6ee7b7', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Power (under More)
          </button>{' '}
          to generate a real, honest result here.
        </div>
      )}
    </div>
  );
}

export default ProofTab;
