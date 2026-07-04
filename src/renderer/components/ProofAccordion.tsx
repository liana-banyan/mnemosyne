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

function TrophyBody(): React.ReactElement {
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

  return (
    <div style={trophyCard}>
      <div style={kappaLabel}>Cohen's Kappa</div>
      <div style={kappaValue}>1.000</div>
      <div style={subText}>
        Perfect agreement between AI and human judgment across 75 benchmark questions.
      </div>
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
        title="BP074 Sound Barrier -- Cohen's Kappa 1.000 Trophy"
        isOpen={open[2]}
        onToggle={(): void => toggle(2)}
      >
        <TrophyBody />
      </AccordionItem>
    </div>
  );
}

export default ProofAccordion;
