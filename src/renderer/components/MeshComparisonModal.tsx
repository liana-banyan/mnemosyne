/**
 * MeshComparisonModal.tsx — BP082 v0.3.1 3-Condition Mesh Comparison modal
 *
 * Triggered from 🔬 Run Mesh Comparison Test in Plow the Field.
 * Shows live A/B/C accuracy per domain during the run.
 * Receipt auto-written to Asteroid-ProofVault on completion.
 *
 * Caithedral spelling per BP081 blood statute.
 * Model mandate: Sonnet 4.6 per BP081 BLOOD STATUTE.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeshDomainResult {
  domain: string;
  n: number;
  a_accuracy: number;
  b_accuracy: number;
  c_accuracy: number;
  c_minus_a_pp: number;
  b_minus_a_pp: number;
  c_minus_b_pp: number;
  a_verified: number;
  b_verified: number;
  c_verified: number;
}

interface MeshComparisonResult {
  a_aggregate: number;
  b_aggregate: number;
  c_aggregate: number;
  c_minus_a_pp: number;
  b_minus_a_pp: number;
  c_minus_b_pp: number;
  totalQuestions: number;
  totalA: number;
  totalB: number;
  totalC: number;
  substrateGrowth: number;
  domainResults: MeshDomainResult[];
  elapsedMs: number;
  hostname: string;
  config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string; maxLoopAttempts?: number };
  startedAt: number;
}

type ModalState =
  | { id: 'idle' }
  | {
      id: 'running';
      domainIndex: number;
      totalDomains: number;
      currentDomain: string;
      currentQ: number;
      currentN: number;
      aAccuracy: number;
      bAccuracy: number;
      cAccuracy: number;
      doneResults: MeshDomainResult[];
    }
  | { id: 'complete'; result: MeshComparisonResult }
  | { id: 'error'; message: string };

// SEG-3.5 BP083: free-form number input replaces the fixed select dropdown.
// Max per domain is ~379 (smallest bank = history/384 minus 5 shot examples).
// Old select options are preserved as quick-pick buttons below the input.
const N_QUICK_PICKS = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '30', value: 30 },
  { label: '100', value: 100 },
  { label: 'All', value: 0 },
] as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#0f172a',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 14,
    padding: '28px 32px',
    width: 560,
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 },
  sub: { fontSize: 12, color: '#64748b', marginBottom: 18 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, display: 'block' as const },
  select: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 16,
    outline: 'none',
  },
  conditionTable: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 18,
  },
  condRow: {
    display: 'flex',
    gap: 10,
    padding: '6px 0',
    borderBottom: '1px solid rgba(100,116,139,0.08)',
    alignItems: 'flex-start',
  },
  condLabel: (letter: 'A' | 'B' | 'C') => ({
    fontSize: 13,
    fontWeight: 800,
    color: letter === 'A' ? '#94a3b8' : letter === 'B' ? '#a5b4fc' : '#6ee7b7',
    minWidth: 22,
    paddingTop: 1,
  }),
  condText: { fontSize: 11, color: '#94a3b8', lineHeight: 1.5 as const },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: {
    background: 'rgba(100,116,139,0.12)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: '#94a3b8',
    padding: '9px 18px',
    fontSize: 13,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'rgba(16,185,129,0.88)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  domainRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.02)',
    marginBottom: 4,
    gap: 8,
  },
  liftBadge: (pp: number) => ({
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 10,
    background: pp > 0 ? 'rgba(110,231,183,0.12)' : pp < -1 ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.1)',
    color: pp > 0 ? '#6ee7b7' : pp < -1 ? '#f87171' : '#94a3b8',
    fontWeight: 700,
  }),
  receiptBox: {
    background: 'rgba(110,231,183,0.06)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 14,
    fontSize: 11,
    color: '#6ee7b7',
  },
};

function pct(v: number): string { return (v * 100).toFixed(1) + '%'; }
function pp(v: number): string { return (v >= 0 ? '+' : '') + v.toFixed(1) + 'pp'; }
function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function estimateTime(n: number): string {
  if (n === 0) return '10–20 hours (all questions × 3 conditions)';
  // Each question runs A+B+C in parallel. B and C each spawn 3 parallel voter calls.
  // Wall-clock ~90s/question with parallel voters. C may retry up to 5×.
  const secsPerQ = 90;
  const total = n * 14 * secsPerQ;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `~${m} minutes`;
  if (m === 0) return `~${h} hour${h > 1 ? 's' : ''}`;
  return `~${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeshComparisonModal({ onClose }: { onClose: () => void }) {
  const [nPerDomain, setNPerDomain] = useState<number>(30);
  // SEG-3.5 BP083: always-current ref prevents stale closure in handleStart
  const nPerDomainRef = useRef(nPerDomain);
  nPerDomainRef.current = nPerDomain;
  const [state, setState] = useState<ModalState>({ id: 'idle' });
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const unsub = window.amplify?.onMeshComparisonProgress?.((event) => {
      const ev = event as Record<string, unknown>;
      if (ev.type === 'domain-start') {
        setState((prev) => ({
          id: 'running',
          domainIndex: ev.domainIndex as number,
          totalDomains: ev.totalDomains as number,
          currentDomain: ev.domain as string,
          currentQ: 0,
          currentN: ev.n as number,
          aAccuracy: 0,
          bAccuracy: 0,
          cAccuracy: 0,
          doneResults: prev.id === 'running' ? prev.doneResults : [],
        }));
      } else if (ev.type === 'question-done') {
        setState((prev) => {
          if (prev.id !== 'running') return prev;
          return {
            ...prev,
            currentQ: (ev.questionIndex as number) + 1,
            currentN: ev.n as number,
            aAccuracy: ev.aAccuracy as number,
            bAccuracy: ev.bAccuracy as number,
            cAccuracy: ev.cAccuracy as number,
          };
        });
      } else if (ev.type === 'domain-done') {
        setState((prev) => {
          if (prev.id !== 'running') return prev;
          return {
            ...prev,
            doneResults: [...prev.doneResults, ev.result as MeshDomainResult],
          };
        });
      } else if (ev.type === 'smoke-test') {
        setState((prev) => {
          if (prev.id !== 'running') return prev;
          const msg = (ev.message as string | undefined) ?? 'running…';
          const aScore = ev.aScore as number | undefined;
          const bScore = ev.bScore as number | undefined;
          const cScore = ev.cScore as number | undefined;
          const smokeLabel = (aScore !== undefined && bScore !== undefined && cScore !== undefined)
            ? `Smoke: A=${aScore}/3 B=${bScore}/3 C=${cScore}/3 — ${msg}`
            : `Smoke test: ${msg}`;
          return { ...prev, currentDomain: smokeLabel };
        });
      } else if (ev.type === 'complete') {
        runningRef.current = false;
        setState({ id: 'complete', result: ev.result as MeshComparisonResult });
        if (typeof ev.receiptPath === 'string') setReceiptPath(ev.receiptPath);
      } else if (ev.type === 'error') {
        runningRef.current = false;
        setState({ id: 'error', message: (ev.message as string | undefined) ?? 'Unknown error' });
      }
    });
    return () => { unsub?.(); };
  }, []);

  const handleStart = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    // SEG-3.5 BP083: read via ref to avoid any stale closure race
    const n = nPerDomainRef.current;
    setState({
      id: 'running',
      domainIndex: 0,
      totalDomains: 14,
      currentDomain: 'loading…',
      currentQ: 0,
      currentN: n,
      aAccuracy: 0,
      bAccuracy: 0,
      cAccuracy: 0,
      doneResults: [],
    });
    try {
      await window.amplify?.runMeshComparison?.({
        nPerDomain: n,
        randomSeed: 42,
        model: 'gemma4:12b',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
      });
    } catch (err) {
      runningRef.current = false;
      setState({ id: 'error', message: (err as Error).message });
    }
  // SEG-3.5 BP083: nPerDomain removed from deps — read via nPerDomainRef.current
  }, []);

  const handleCancel = useCallback(async () => {
    await window.amplify?.cancelMeshComparison?.();
    runningRef.current = false;
    onClose();
  }, [onClose]);

  // ── Idle: config screen ────────────────────────────────────────────────────

  if (state.id === 'idle') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>🔬 Mesh Comparison Test</div>
          <div style={S.sub}>
            Tests three conditions on the same questions to measure the cooperative architecture's actual lift.
          </div>

          <div style={S.conditionTable}>
            <div style={{ ...S.condRow, borderBottom: '1px solid rgba(100,116,139,0.15)', paddingBottom: 8, marginBottom: 4 }}>
              <div style={{ ...S.condLabel('A'), minWidth: 120, color: '#64748b', fontSize: 10, fontWeight: 700 }}>CONDITION</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>DESCRIPTION</div>
            </div>
            <div style={S.condRow}>
              <div style={S.condLabel('A')}>A</div>
              <div style={S.condText}>
                <strong style={{ color: '#e2e8f0' }}>Cold</strong> — single-shot, no concordance, no substrate.
                Bottom floor: raw Gemma 4 12B alone.
              </div>
            </div>
            <div style={S.condRow}>
              <div style={S.condLabel('B')}>B</div>
              <div style={S.condText}>
                <strong style={{ color: '#e2e8f0' }}>Seeded single-pass</strong> — 3-voter Shadow E-Giant concordance, single-pass.
                The apples-to-apples mode (v0.2.3 Beat-Google behavior). Shows concordance value.
              </div>
            </div>
            <div style={{ ...S.condRow, borderBottom: 'none' }}>
              <div style={S.condLabel('C')}>C</div>
              <div style={S.condText}>
                <strong style={{ color: '#6ee7b7' }}>Seeded + Loop</strong> — 3-voter concordance + Andon Cord retry until concordance, MAX=5 attempts.
                What the cooperative architecture actually delivers. Substrate grows.
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
            <strong style={{ color: '#6ee7b7' }}>Publishable lift: C − A</strong> — cooperative-architecture lift<br/>
            B − A shows concordance value alone · C − B shows loop value alone
          </div>

          {/* SEG-3.5 BP083: free-form input so any value runs — no silent cap */}
          <label style={S.label}>Questions per domain (14 domains locked)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              type="number"
              min={1}
              max={379}
              value={nPerDomain === 0 ? '' : nPerDomain}
              placeholder="e.g. 30"
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Math.max(1, Math.min(379, Number(e.target.value)));
                setNPerDomain(v);
              }}
              style={{
                background: '#111827',
                border: '1px solid #1e2a38',
                borderRadius: 6,
                color: '#e2e8f0',
                fontSize: 13,
                padding: '6px 10px',
                width: 90,
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: '#475569' }}>
              × 14 domains = {nPerDomain === 0 ? 'all' : nPerDomain * 14} total q
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {N_QUICK_PICKS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setNPerDomain(o.value)}
                style={{
                  background: nPerDomain === o.value ? 'rgba(110,231,183,0.18)' : 'none',
                  border: `1px solid ${nPerDomain === o.value ? '#10b981' : '#334155'}`,
                  borderRadius: 5,
                  color: nPerDomain === o.value ? '#6ee7b7' : '#94a3b8',
                  fontSize: 11,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 18, lineHeight: 1.5 }}>
            Estimated wall-clock: {estimateTime(nPerDomain)}<br/>
            Receipt auto-written to Asteroid-ProofVault/ on completion.
          </div>

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={S.primaryBtn} onClick={() => { void handleStart(); }}>
              Confirm Run 🔬
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running ────────────────────────────────────────────────────────────────

  if (state.id === 'running') {
    const overallPct = state.totalDomains > 0
      ? Math.round(((state.domainIndex + state.currentQ / Math.max(state.currentN, 1)) / state.totalDomains) * 100)
      : 0;

    return (
      <div style={S.overlay}>
        <div style={S.modal}>
          <div style={S.header}>🔄 Mesh Comparison Running…</div>
          <div style={S.sub}>Running A/B/C in parallel per question. Do not close.</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <span>Overall progress</span><span>{overallPct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6 }}>
              <div style={{ width: `${overallPct}%`, background: '#6366f1', borderRadius: 4, height: 6, transition: 'width 0.3s' }} />
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Domain {state.domainIndex + 1}/{state.totalDomains}: <strong style={{ color: '#e2e8f0' }}>{state.currentDomain}</strong>
            {' '}— Q {state.currentQ}/{state.currentN}
          </div>

          {/* Live A/B/C accuracy bars */}
          {state.currentQ > 0 && (
            <div style={{ marginBottom: 14, background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '10px 14px' }}>
              {(['A', 'B', 'C'] as const).map((letter) => {
                const acc = letter === 'A' ? state.aAccuracy : letter === 'B' ? state.bAccuracy : state.cAccuracy;
                const color = letter === 'A' ? '#94a3b8' : letter === 'B' ? '#a5b4fc' : '#6ee7b7';
                return (
                  <div key={letter} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color }}>{letter} ({letter === 'A' ? 'Cold' : letter === 'B' ? 'Seeded' : 'Seeded+Loop'})</span>
                      <span style={{ color }}>{pct(acc)}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 4 }}>
                      <div style={{ width: `${acc * 100}%`, background: color, borderRadius: 3, height: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {state.doneResults.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Completed domains</div>
              {state.doneResults.map((d) => (
                <div key={d.domain} style={S.domainRow}>
                  <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{d.domain.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{pct(d.a_accuracy)}</span>
                  <span style={{ fontSize: 10, color: '#a5b4fc' }}>{pct(d.b_accuracy)}</span>
                  <span style={{ fontSize: 10, color: '#6ee7b7' }}>{pct(d.c_accuracy)}</span>
                  <span style={S.liftBadge(d.c_minus_a_pp)}>{pp(d.c_minus_a_pp)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={() => { void handleCancel(); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────────────

  if (state.id === 'complete') {
    const { result } = state;
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>🔬 Mesh Comparison Complete</div>

          {/* Headline lift banner */}
          <div style={{ background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
              Cold (A):{' '}
              <strong style={{ color: '#e2e8f0' }}>{pct(result.a_aggregate)}</strong>
              {' '}· Seeded (B):{' '}
              <strong style={{ color: '#a5b4fc' }}>{pct(result.b_aggregate)}</strong>
              {' '}· Loop (C):{' '}
              <strong style={{ color: '#6ee7b7' }}>{pct(result.c_aggregate)}</strong>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: result.c_minus_a_pp >= 0 ? '#6ee7b7' : '#f87171' }}>
              Cooperative lift (C − A): {pp(result.c_minus_a_pp)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              B − A (concordance): {pp(result.b_minus_a_pp)} · C − B (loop): {pp(result.c_minus_b_pp)}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              {result.substrateGrowth} new eblets · {formatMs(result.elapsedMs)}
            </div>
          </div>

          {/* Per-domain table */}
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
            Per-domain · A / B / C / C−A lift
          </div>
          <div style={{ marginBottom: 14 }}>
            {result.domainResults.map((d) => (
              <div key={d.domain} style={S.domainRow}>
                <span style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>{d.domain.replace(/_/g, ' ')}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{pct(d.a_accuracy)}</span>
                <span style={{ fontSize: 10, color: '#a5b4fc' }}>{pct(d.b_accuracy)}</span>
                <span style={{ fontSize: 10, color: '#6ee7b7' }}>{pct(d.c_accuracy)}</span>
                <span style={S.liftBadge(d.c_minus_a_pp)}>{pp(d.c_minus_a_pp)}</span>
              </div>
            ))}
          </div>

          {receiptPath && (
            <div style={S.receiptBox}>
              ✓ Receipt saved: <span style={{ fontSize: 10, opacity: 0.8 }}>{receiptPath}</span>
            </div>
          )}

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (state.id === 'error') {
    // Split message into headline and diagnostic lines (BP078 every-click-feedback canon)
    const [headline, ...diagLines] = state.message.split('\n');
    const hasDiag = diagLines.length > 0;
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>❌ Mesh Comparison Error</div>
          <div style={{ fontSize: 13, color: '#f87171', margin: '12px 0 8px', lineHeight: 1.5 }}>
            {headline}
          </div>
          {hasDiag && (
            <div style={{
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 11,
              color: '#fca5a5',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap' as const,
              fontFamily: 'monospace',
            }}>
              {diagLines.join('\n')}
            </div>
          )}
          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
