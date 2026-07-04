/**
 * BenchmarkModal.tsx — BP082 v0.2.3 "Beat-Google Benchmark" modal
 *
 * Triggered from the 🏁 button in Test It Out → Plow the Field.
 * Config: N per domain (10/30/50/100/all), methodology locked to 5-shot CoT.
 * Shows live domain-by-domain progress during run.
 * Generates + writes receipt on completion.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainResult {
  domain: string;
  n: number;
  verified: number;
  accuracy: number;
  googleBaseline: number;
  liftPp: number;
}

interface BenchmarkResult {
  aggregateLiana: number;
  aggregateGoogle: number;
  liftPp: number;
  verdict: 'BEAT' | 'TIED' | 'SHORT';
  totalQuestions: number;
  totalVerified: number;
  domainResults: DomainResult[];
  elapsedMs: number;
  hostname: string;
  config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string };
  startedAt: number;
  completedAt: number;
  questions: unknown[];
}

type BenchmarkState =
  | { id: 'idle' }
  | { id: 'configuring' }
  | { id: 'running'; domainIndex: number; totalDomains: number; currentDomain: string; currentDomainQ: number; currentDomainN: number; domainAccuracy: number; doneResults: DomainResult[] }
  | { id: 'complete'; result: BenchmarkResult }
  | { id: 'error'; message: string };

const N_OPTIONS = [
  { label: '10 (quick ~20min)', value: 10 },
  { label: '30 (~1hr)', value: 30 },
  { label: '50 (~1.5hr)', value: 50 },
  { label: '100 (overnight ~3hr)', value: 100 },
  { label: 'All questions (5–8hr)', value: 0 },
] as const;

const GOOGLE_BASELINE = 0.772;

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function estimateTime(n: number): string {
  if (n === 0) return '5–8 hours (all questions)';
  const secsPerQ = 60; // 3 parallel voters × ~20s each = ~60s wall-clock
  const total = n * 14 * secsPerQ;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `~${m} minutes`;
  if (m === 0) return `~${h} hour${h > 1 ? 's' : ''}`;
  return `~${h}h ${m}m`;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
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
    width: 520,
    maxWidth: '95vw',
    maxHeight: '88vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 6,
  },
  sub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    display: 'block',
  },
  select: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 16,
  },
  infoBox: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 20,
  },
  infoRow: {
    fontSize: 12,
    color: '#a5b4fc',
    marginBottom: 4,
    display: 'flex',
    justifyContent: 'space-between',
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    background: 'rgba(100,116,139,0.12)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: '#94a3b8',
    padding: '9px 18px',
    fontSize: 13,
    cursor: 'pointer',
  },
  primaryBtn: (disabled: boolean) => ({
    background: disabled ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.9)',
    border: 'none',
    borderRadius: 8,
    color: disabled ? '#6ee7b7' : '#fff',
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }),
  progressDomain: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  domainRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.025)',
    marginBottom: 4,
  },
  verdictBeat: { color: '#6ee7b7', fontSize: 22, fontWeight: 800 },
  verdictTied: { color: '#fbbf24', fontSize: 22, fontWeight: 800 },
  verdictShort: { color: '#f87171', fontSize: 22, fontWeight: 800 },
  receiptBtn: {
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.35)',
    borderRadius: 8,
    color: '#6ee7b7',
    padding: '8px 16px',
    fontSize: 12,
    cursor: 'pointer',
    marginTop: 12,
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

interface BenchmarkModalProps {
  onClose: () => void;
}

export function BenchmarkModal({ onClose }: BenchmarkModalProps) {
  const [nPerDomain, setNPerDomain] = useState<number>(30);
  const [state, setState] = useState<BenchmarkState>({ id: 'idle' });
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Clean up progress listener on unmount
  useEffect(() => {
    const unsub = window.amplify?.onBenchmarkProgress?.((event) => {
      if (event.type === 'domain-start') {
        setState((prev) => ({
          id: 'running',
          domainIndex: event.domainIndex,
          totalDomains: event.totalDomains,
          currentDomain: event.domain,
          currentDomainQ: 0,
          currentDomainN: event.n,
          domainAccuracy: 0,
          doneResults: prev.id === 'running' ? prev.doneResults : [],
        }));
      } else if (event.type === 'question-done') {
        setState((prev) => {
          if (prev.id !== 'running') return prev;
          return {
            ...prev,
            currentDomainQ: event.questionIndex + 1,
            currentDomainN: event.n,
            domainAccuracy: event.domainAccuracy,
          };
        });
      } else if (event.type === 'domain-done') {
        setState((prev) => {
          if (prev.id !== 'running') return prev;
          return {
            ...prev,
            doneResults: [...prev.doneResults, event.result as DomainResult],
          };
        });
      } else if (event.type === 'complete') {
        runningRef.current = false;
        const result = event.result as BenchmarkResult;
        setState({ id: 'complete', result });
        // receiptPath is auto-written by main process; included in the complete event
        if (typeof event.receiptPath === 'string') {
          setReceiptPath(event.receiptPath);
        }
      } else if ((event as { type: string }).type === 'error') {
        runningRef.current = false;
        setState({ id: 'error', message: (event as { message?: string }).message ?? 'Unknown error' });
      }
    });
    return () => { unsub?.(); };
  }, []);

  const handleStart = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState({
      id: 'running',
      domainIndex: 0,
      totalDomains: 14,
      currentDomain: 'loading...',
      currentDomainQ: 0,
      currentDomainN: nPerDomain,
      domainAccuracy: 0,
      doneResults: [],
    });

    try {
      await window.amplify?.runBenchmark?.({
        nPerDomain,
        randomSeed: 42,
        model: 'gemma4:12b',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
      });
    } catch (err) {
      runningRef.current = false;
      setState({ id: 'error', message: (err as Error).message });
    }
  }, [nPerDomain]);

  const handleCancel = useCallback(async () => {
    await window.amplify?.cancelBenchmark?.();
    runningRef.current = false;
    onClose();
  }, [onClose]);

  // ── Render: idle / configuring ─────────────────────────────────────────────

  if (state.id === 'idle') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>🏁 Apples-to-Apples Handicapped Comparison</div>
          <div style={S.sub}>
            Single-pass 3-voter concordance vs Google's published Gemma 4 12B MMLU-Pro baseline (77.2%).
            This is the methodology-handicapped mode (v0.2.3). It does NOT measure the cooperative architecture's
            full structural advantage. Use <strong style={{ color: '#6ee7b7' }}>🔬 Run Mesh Comparison Test</strong> for the publishable lift.
          </div>

          <label style={S.label}>Questions per domain</label>
          <select
            style={S.select}
            value={nPerDomain}
            onChange={(e) => setNPerDomain(Number(e.target.value))}
          >
            {N_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div style={S.infoBox}>
            <div style={S.infoRow}><span>Methodology</span><span>5-shot CoT, letter extraction</span></div>
            <div style={S.infoRow}><span>Verification</span><span>3-voter Shadow E-Giant concordance</span></div>
            <div style={S.infoRow}><span>Google baseline</span><span>77.2% aggregate (Gemma 4 12B)</span></div>
            <div style={S.infoRow}><span>Domains</span><span>14 × {nPerDomain === 0 ? 'all' : nPerDomain} questions</span></div>
            <div style={S.infoRow}><span>Estimated time</span><span>{estimateTime(nPerDomain)}</span></div>
          </div>

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 18, lineHeight: 1.5 }}>
            Receipt auto-written to userData/benchmark_receipts/ and Asteroid-ProofVault/ on completion.
          </div>

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              style={S.primaryBtn(false)}
              onClick={() => { void handleStart(); }}
            >
              Confirm Run 🏁
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: running ────────────────────────────────────────────────────────

  if (state.id === 'running') {
    const overallPct = state.totalDomains > 0
      ? Math.round(((state.domainIndex + state.currentDomainQ / Math.max(state.currentDomainN, 1)) / state.totalDomains) * 100)
      : 0;

    return (
      <div style={S.overlay}>
        <div style={S.modal}>
          <div style={S.header}>🔄 Benchmark Running…</div>
          <div style={S.sub}>Do not close. You can leave this running overnight.</div>

          {/* Overall progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <span>Overall progress</span><span>{overallPct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6 }}>
              <div style={{ width: `${overallPct}%`, background: '#6366f1', borderRadius: 4, height: 6, transition: 'width 0.3s' }} />
            </div>
          </div>

          <div style={S.progressDomain}>
            Domain {state.domainIndex + 1}/{state.totalDomains}: <strong style={{ color: '#e2e8f0' }}>{state.currentDomain}</strong>
            {' '}— Q {state.currentDomainQ}/{state.currentDomainN}
            {' '}— accuracy {pct(state.domainAccuracy)}
          </div>

          {/* Completed domains */}
          {state.doneResults.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed domains</div>
              {state.doneResults.map((d) => (
                <div key={d.domain} style={S.domainRow}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.domain}</span>
                  <span style={{ fontSize: 12, color: d.liftPp >= 0 ? '#6ee7b7' : '#f87171' }}>
                    {pct(d.accuracy)} ({d.liftPp >= 0 ? '+' : ''}{d.liftPp.toFixed(1)}pp)
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={() => { void handleCancel(); }}>
              Cancel Benchmark
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: complete ───────────────────────────────────────────────────────

  if (state.id === 'complete') {
    const { result } = state;
    const verdictStyle = result.verdict === 'BEAT' ? S.verdictBeat : result.verdict === 'TIED' ? S.verdictTied : S.verdictShort;
    const verdictEmoji = result.verdict === 'BEAT' ? '🏆' : result.verdict === 'TIED' ? '🤝' : '📉';

    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>Benchmark Complete {verdictEmoji}</div>

          <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
            <div style={verdictStyle}>{result.verdict}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
              Liana: <strong style={{ color: '#e2e8f0' }}>{pct(result.aggregateLiana)}</strong>
              {' '}vs Google: <strong style={{ color: '#e2e8f0' }}>{pct(result.aggregateGoogle)}</strong>
              {' '}— lift: <strong style={{ color: result.liftPp >= 0 ? '#6ee7b7' : '#f87171' }}>
                {result.liftPp >= 0 ? '+' : ''}{result.liftPp.toFixed(2)} pp
              </strong>
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              {result.totalVerified}/{result.totalQuestions} verified · {formatMs(result.elapsedMs)}
            </div>
          </div>

          {/* Per-domain table */}
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per-domain results</div>
          <div style={{ marginBottom: 16 }}>
            {result.domainResults.map((d) => (
              <div key={d.domain} style={S.domainRow}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 130 }}>{d.domain.replace(/_/g, ' ')}</span>
                <span style={{ fontSize: 11, color: '#e2e8f0' }}>{pct(d.accuracy)}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>vs {pct(d.googleBaseline)}</span>
                <span style={{ fontSize: 11, color: d.liftPp >= 0 ? '#6ee7b7' : '#f87171' }}>
                  {d.liftPp >= 0 ? '+' : ''}{d.liftPp.toFixed(1)}pp
                </span>
              </div>
            ))}
          </div>

          {receiptPath && (
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              ✓ Receipt saved: <span style={{ color: '#6ee7b7', fontSize: 10 }}>{receiptPath}</span>
            </div>
          )}

          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (state.id === 'error') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>❌ Benchmark Error</div>
          <div style={{ fontSize: 13, color: '#f87171', margin: '12px 0 20px', lineHeight: 1.5 }}>
            {state.message}
          </div>
          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
