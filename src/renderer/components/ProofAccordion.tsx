// ProofAccordion.tsx -- SEG-U-3/7 BP078 v0.1.36
// Three-accordion proof area: HOT/COLD chart, mesh benchmark, kappa trophy.
// SEG-U-7: listens for 'mesh-test-complete' IPC to populate item 2.

import React, { useState, useEffect, useRef } from 'react';
import { BenchmarkProofChart } from './BenchmarkProofChart';

export interface MeshTestMetrics {
  hot_accuracy_pct: number;
  cold_accuracy_pct: number;
  delta_pp: number;
  fast_cheap_good: string;
  svgPath?: string;
}

interface AccordionItemProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({ title, isOpen, onToggle, children }: AccordionItemProps): React.ReactElement {
  const bodyRef = useRef<HTMLDivElement>(null);

  const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    cursor: 'pointer',
    background: '#1e293b',
    borderRadius: isOpen ? '6px 6px 0 0' : 6,
    border: '1px solid rgba(100, 116, 139, 0.25)',
    borderBottom: isOpen ? '1px solid rgba(100, 116, 139, 0.15)' : '1px solid rgba(100, 116, 139, 0.25)',
    userSelect: 'none',
    transition: 'background 120ms ease',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.02em',
  };

  const chevronStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    color: '#475569',
    flexShrink: 0,
    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 220ms ease',
  };

  const bodyWrap: React.CSSProperties = {
    overflow: 'hidden',
    maxHeight: isOpen ? 600 : 0,
    transition: 'max-height 280ms ease',
    border: isOpen ? '1px solid rgba(100, 116, 139, 0.25)' : 'none',
    borderTop: 'none',
    borderRadius: '0 0 6px 6px',
  };

  const bodyInner: React.CSSProperties = {
    padding: '12px 14px',
    background: '#111827',
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={header} onClick={onToggle} role="button" aria-expanded={isOpen}>
        <span style={titleStyle}>{title}</span>
        <svg style={chevronStyle} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={bodyWrap} ref={bodyRef} aria-hidden={!isOpen}>
        <div style={bodyInner}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MeshPendingBody(): React.ReactElement {
  return (
    <div className="mesh-pending" style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, padding: '4px 0' }}>
      Mesh benchmark pending -- results will populate here after the three-node test completes.
    </div>
  );
}

function MeshResultsBody({ metrics }: { metrics: MeshTestMetrics }): React.ReactElement {
  const deltaSign = metrics.delta_pp >= 0 ? '+' : '';

  const statBlock: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const bigStat: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: '#6ee7b7',
    lineHeight: 1.2,
  };

  const statLabel: React.CSSProperties = {
    fontSize: 11,
    color: '#475569',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 2,
  };

  const row: React.CSSProperties = {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  };

  const cell: React.CSSProperties = {
    flex: '1 1 80px',
  };

  return (
    <div style={statBlock}>
      <div style={{ marginBottom: 4 }}>
        <div style={statLabel}>HOT vs COLD accuracy lift</div>
        <div style={bigStat}>{deltaSign}{metrics.delta_pp.toFixed(1)} pp</div>
      </div>
      <div style={row}>
        <div style={cell}>
          <div style={statLabel}>HOT accuracy</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#60a5fa' }}>{metrics.hot_accuracy_pct.toFixed(1)}%</div>
        </div>
        <div style={cell}>
          <div style={statLabel}>COLD accuracy</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b' }}>{metrics.cold_accuracy_pct.toFixed(1)}%</div>
        </div>
        {metrics.fast_cheap_good && (
          <div style={cell}>
            <div style={statLabel}>FCG score</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa' }}>{metrics.fast_cheap_good}</div>
          </div>
        )}
      </div>
      {metrics.svgPath && (
        <img
          src={metrics.svgPath}
          alt="Mesh test big numbers"
          style={{ width: '100%', marginTop: 8, borderRadius: 4 }}
        />
      )}
    </div>
  );
}

// D-BP223-BM0-X010-020-KAPPA: the trophy card used to hardcode "1.000" with no receipt
// (flagged fabricated by BM0/X009 outbox #775 2026-09-09, re-verified live by SEG X010-019
// 2026-09-10; Founder order 2026-09-10 13:58 Central was to measure it for real and show
// the receipt, not delete it). This now reads amplify.getKappaReceipt() -- backed by
// resources/kappa_receipt.json, itself generated only from real checkpoint artifacts under
// BISHOP_DROPZONE\D-BP165-M0-019_MMLU_PRO_SWEEP by compute_kappa.js -- and renders whatever
// that receipt says, including an honest "not yet measured" state if it is absent.
export interface KappaReceipt {
  measured: boolean;
  measuredUtc?: string;
  method?: string;
  primary?: { label: string; n: number; kappa: number; ci95: [number, number] };
  corroboration?: Array<{ label: string; n: number; kappa: number; ci95: [number, number] }>;
}

// D-BP223-BM0-X010-026-HUMANKAPPA: Rule 66 sibling shape -- the REAL AI-vs-human receipt.
export interface KappaHumanReceipt {
  measured: boolean;
  measuredUtc?: string;
  method?: string;
  primary?: { label: string; n: number; kappa: number; ci95: [number, number] };
  raters?: string[];
  accuracy?: Record<string, { correct: number; total: number; rate: number }>;
}

function TrophyBody(): React.ReactElement {
  const [receipt, setReceipt] = useState<KappaReceipt | null>(null);
  const [humanReceipt, setHumanReceipt] = useState<KappaHumanReceipt | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const amplify = (window as Window & typeof globalThis).amplify as typeof window.amplify | undefined;
    if (!amplify?.getKappaReceipt) { setLoaded(true); return; }
    let cancelled = false;
    Promise.all([
      amplify.getKappaReceipt().catch(() => null),
      amplify.getKappaHumanReceipt ? amplify.getKappaHumanReceipt().catch(() => null) : Promise.resolve(null),
    ])
      .then(([r, hr]) => {
        if (cancelled) return;
        if (r) setReceipt(r as KappaReceipt);
        if (hr) setHumanReceipt(hr as KappaHumanReceipt);
      })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const trophyCard: React.CSSProperties = {
    border: '1px solid rgba(234, 179, 8, 0.4)',
    borderRadius: 8,
    background: 'rgba(234, 179, 8, 0.05)',
    padding: '14px 16px',
  };

  const kappaValue: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 900,
    color: '#eab308',
    lineHeight: 1.1,
    marginBottom: 4,
  };

  const kappaLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#92400e',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 10,
  };

  const subText: React.CSSProperties = {
    fontSize: 12,
    color: '#78716c',
    lineHeight: 1.55,
  };

  const receiptLine: React.CSSProperties = {
    fontSize: 10.5,
    color: '#a8a29e',
    lineHeight: 1.5,
    marginTop: 8,
    borderTop: '1px solid rgba(120,113,108,0.25)',
    paddingTop: 6,
  };

  if (!loaded) {
    return (
      <div style={trophyCard}>
        <div style={kappaLabel}>Cohen's Kappa</div>
        <div style={{ ...subText, fontStyle: 'italic' }}>Loading measured value…</div>
      </div>
    );
  }

  if (!receipt || !receipt.measured || !receipt.primary) {
    return (
      <div style={trophyCard}>
        <div style={kappaLabel}>Cohen's Kappa</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#a8a29e' }}>Not yet measured</div>
        <div style={subText}>
          No measured-kappa receipt is on disk yet. This card intentionally shows no number
          rather than a placeholder or an old claim.
        </div>
      </div>
    );
  }

  const { n, kappa, ci95, label } = receipt.primary;
  const humanCard = humanReceipt && humanReceipt.measured && humanReceipt.primary
    ? (
      <div style={{ ...trophyCard, marginTop: 10 }}>
        <div style={kappaLabel}>Cohen's Kappa -- Founder vs. free path (measured)</div>
        <div style={kappaValue}>{humanReceipt.primary.kappa.toFixed(3)}</div>
        <div style={subText}>
          {humanReceipt.raters ? humanReceipt.raters.join(' vs. ') : 'Founder vs. free path'}, n={humanReceipt.primary.n} items,
          out-of-sample. 95% CI [{humanReceipt.primary.ci95[0].toFixed(3)}, {humanReceipt.primary.ci95[1].toFixed(3)}] (bootstrap).
        </div>
        {humanReceipt.accuracy && (
          <div style={receiptLine}>
            {Object.entries(humanReceipt.accuracy).map(([who, a]) => `${who}: ${a.correct}/${a.total} (${(a.rate * 100).toFixed(0)}%)`).join('  ·  ')}
          </div>
        )}
        {humanReceipt.method && <div style={receiptLine}>{humanReceipt.method}</div>}
        {humanReceipt.measuredUtc && (
          <div style={receiptLine}>Measured {new Date(humanReceipt.measuredUtc).toLocaleString()}</div>
        )}
      </div>
    )
    : (
      <div style={{ ...trophyCard, marginTop: 10 }}>
        <div style={kappaLabel}>Cohen's Kappa -- Founder vs. free path</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a8a29e' }}>Not yet measured</div>
        <div style={subText}>Waiting on the Founder's 50-item hand-labeled sheet (D-BP223-BM0-X010-026-HUMANKAPPA).</div>
      </div>
    );
  return (
    <div>
      <div style={trophyCard}>
        <div style={kappaLabel}>Cohen's Kappa -- baseline vs. method (measured)</div>
        <div style={kappaValue}>{kappa.toFixed(3)}</div>
        <div style={subText}>
          Measured agreement, n={n} items ({label}). 95% CI [{ci95[0].toFixed(3)}, {ci95[1].toFixed(3)}].
        </div>
        {receipt.method && <div style={receiptLine}>{receipt.method}</div>}
        {receipt.measuredUtc && (
          <div style={receiptLine}>Measured {new Date(receipt.measuredUtc).toLocaleString()}</div>
        )}
        {receipt.corroboration && receipt.corroboration.length > 0 && (
          <div style={receiptLine}>
            Corroborating runs: {receipt.corroboration.map((c) => `${c.label} (n=${c.n}, κ=${c.kappa.toFixed(3)})`).join('; ')}
          </div>
        )}
      </div>
      {humanCard}
    </div>
  );
}

export function ProofAccordion(): React.ReactElement {
  const [open, setOpen] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [meshMetrics, setMeshMetrics] = useState<MeshTestMetrics | null>(null);
  const firstMeshRef = useRef(false);

  const toggle = (idx: 0 | 1 | 2): void => {
    setOpen((prev) => {
      const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean];
      next[idx] = !next[idx];
      return next;
    });
  };

  useEffect(() => {
    const amplify = (window as Window & typeof globalThis).amplify as typeof window.amplify | undefined;
    if (!amplify?.onMeshTestComplete) return;

    const unsub = amplify.onMeshTestComplete((metrics: MeshTestMetrics) => {
      setMeshMetrics(metrics);
      if (!firstMeshRef.current) {
        firstMeshRef.current = true;
        setOpen((prev) => {
          const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean];
          next[1] = true;
          return next;
        });
      }
    });

    return unsub;
  }, []);

  const container: React.CSSProperties = {
    margin: '0 0 20px',
    width: '100%',
  };

  return (
    <div style={container}>
      <AccordionItem
        title="HOT/COLD Banyan Metric Results"
        isOpen={open[0]}
        onToggle={(): void => toggle(0)}
      >
        <BenchmarkProofChart />
      </AccordionItem>

      <AccordionItem
        title="Google's Gemma 4 12B MMLU-Pro Benchmark"
        isOpen={open[1]}
        onToggle={(): void => toggle(1)}
      >
        {meshMetrics ? <MeshResultsBody metrics={meshMetrics} /> : <MeshPendingBody />}
      </AccordionItem>

      <AccordionItem
        title="BP074 Sound Barrier -- Cohen's Kappa (measured)"
        isOpen={open[2]}
        onToggle={(): void => toggle(2)}
      >
        <TrophyBody />
      </AccordionItem>
    </div>
  );
}

export default ProofAccordion;
