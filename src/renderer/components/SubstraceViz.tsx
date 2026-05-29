// SubstraceViz — BP060 Application 002 Step 1 v3 · UI-6 · DELTA-3
// Pearl → Eblit → Substrace → Quilt pipeline — true SVG flow diagram.
// §X.A4 fix: text/node-list replaced with <svg> connected nodes + directional arrows.
// Click any node to select its SID for verify.
// "10-Pearl Roundtrip Demo" button animates nodes as they emit/compose.
// NEVER uses "wormhole" — binding discipline.
// decay_class: BETWEEN on all emissions per Application 002 canon.

import React, { useState, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineNode {
  layer: 'Pearl' | 'Eblit' | 'Substrace' | 'Quilt';
  id: string;
  parent_ids?: string[];
  ts: number;
  extra?: Record<string, string>;
}

interface RoundtripResult {
  pearls: string[];
  eblits: Array<{ eblit_id: string; pearl_id: string; null_line: string; decay_class: string }>;
  substrace: { substrace_id: string; eblits: string[]; decay_class: string };
  quilt: { quilt_id: string; substraces: string[]; narrative_tag: string; decay_class: string };
  sid_equality: boolean;
  ts: number;
}

// ─── Layer config ─────────────────────────────────────────────────────────────

const LAYER_CFG: Record<string, {
  color: string; fill: string; stroke: string; icon: string;
  label: string; desc: string; x: number;
}> = {
  Pearl:     { color: '#6ee7b7', fill: 'rgba(110,231,183,0.12)', stroke: 'rgba(110,231,183,0.6)',  icon: '🪶', label: 'Pearl',     desc: 'Atomic data primitive', x: 60  },
  Eblit:     { color: '#fbbf24', fill: 'rgba(251,191,36,0.12)',  stroke: 'rgba(251,191,36,0.6)',  icon: '⚡', label: 'Eblit',     desc: 'Blink-emit trace',      x: 210 },
  Substrace: { color: '#a78bfa', fill: 'rgba(167,139,250,0.12)', stroke: 'rgba(167,139,250,0.6)', icon: '🕸', label: 'Substrace', desc: 'Substrate-lace',        x: 360 },
  Quilt:     { color: '#fb7185', fill: 'rgba(251,113,133,0.12)', stroke: 'rgba(251,113,133,0.6)', icon: '🛡', label: 'Quilt',     desc: 'Kipling Effect artifact', x: 510 },
};
const LAYER_ORDER = ['Pearl', 'Eblit', 'Substrace', 'Quilt'] as const;

const NODE_R = 20;
const NODE_SPACING = 32;
const SVG_W = 640;
const PIPELINE_TOP = 80;

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function nodeY(layerIdx: number, idxInLayer: number, countInLayer: number): number {
  const totalH = Math.max(countInLayer, 1) * NODE_SPACING;
  const startY = PIPELINE_TOP + (idxInLayer * NODE_SPACING);
  return startY;
}

function ArrowMarker() {
  return (
    <defs>
      <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="rgba(110,231,183,0.6)" />
      </marker>
      <marker id="arrow-yellow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="rgba(251,191,36,0.6)" />
      </marker>
      <marker id="arrow-purple" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="rgba(167,139,250,0.6)" />
      </marker>
      <marker id="arrow-pink" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="rgba(251,113,133,0.6)" />
      </marker>
    </defs>
  );
}

const ARROW_IDS: Record<string, string> = {
  Pearl: 'arrow-green', Eblit: 'arrow-yellow', Substrace: 'arrow-purple', Quilt: 'arrow-pink',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SubstraceViz() {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [running, setRunning] = useState(false);
  const [animating, setAnimating] = useState<string | null>(null); // layer being animated
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ sid: string; found: boolean; data?: unknown } | null>(null);
  const [roundtripResult, setRoundtripResult] = useState<RoundtripResult | null>(null);
  const [sidInput, setSidInput] = useState('');
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const layerNodes = (layer: string) => nodes.filter((n) => n.layer === layer);

  const runTenPearlRoundtrip = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setNodes([]);
    setRoundtripResult(null);
    setVerifyResult(null);
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];

    const ct = window.amplify?.caithedralTools;
    if (!ct) {
      setRunning(false);
      return;
    }

    try {
      const res = await ct.ten_pearl_roundtrip();
      if (!res.ok) throw new Error(res.error ?? 'ten_pearl_roundtrip failed');

      const r = res.result as RoundtripResult;
      setRoundtripResult(r);

      // Animate layers sequentially: Pearl → Eblit → Substrace → Quilt
      const allNodes: PipelineNode[] = [
        ...r.pearls.map((p, i) => ({
          layer: 'Pearl' as const, id: p, ts: r.ts + i,
          extra: { idx: String(i) },
        })),
        ...r.eblits.map((e) => ({
          layer: 'Eblit' as const, id: e.eblit_id, parent_ids: [e.pearl_id],
          ts: r.ts + 10, extra: { null_line: e.null_line.slice(0, 8) + '…', decay: e.decay_class },
        })),
        {
          layer: 'Substrace' as const, id: r.substrace.substrace_id,
          parent_ids: r.substrace.eblits, ts: r.ts + 20,
          extra: { decay: r.substrace.decay_class },
        },
        {
          layer: 'Quilt' as const, id: r.quilt.quilt_id,
          parent_ids: r.quilt.substraces, ts: r.ts + 21,
          extra: { tag: r.quilt.narrative_tag.slice(0, 16), decay: r.quilt.decay_class },
        },
      ];

      // Animate: reveal each layer with a 300ms delay
      const delays = [0, 600, 1200, 1800];
      const layers = ['Pearl', 'Eblit', 'Substrace', 'Quilt'];
      layers.forEach((layer, li) => {
        const t = setTimeout(() => {
          setAnimating(layer);
          setNodes((prev) => [
            ...prev.filter((n) => n.layer !== layer),
            ...allNodes.filter((n) => n.layer === layer),
          ]);
          if (li === layers.length - 1) {
            setTimeout(() => { setAnimating(null); setRunning(false); }, 400);
          }
        }, delays[li]);
        animTimers.current.push(t);
      });
    } catch (err) {
      console.error('[SubstraceViz] ten_pearl_roundtrip error:', err);
      setRunning(false);
    }
  }, [running]);

  const verifySid = useCallback(async () => {
    const sid = sidInput.trim() || selectedSid;
    if (!sid) return;
    const ct = window.amplify?.caithedralTools;
    if (!ct) return;
    const res = await ct.soccerball_lookup(sid);
    setVerifyResult({ sid, found: !!(res.ok && res.result), data: res.result });
  }, [sidInput, selectedSid]);

  // ─── SVG layout calculation ────────────────────────────────────────────────

  const pearlNodes  = layerNodes('Pearl');
  const eblitNodes  = layerNodes('Eblit');
  const subNodes    = layerNodes('Substrace');
  const quiltNodes  = layerNodes('Quilt');

  const maxCount = Math.max(pearlNodes.length, eblitNodes.length, subNodes.length, quiltNodes.length, 1);
  const svgH = Math.max(PIPELINE_TOP + maxCount * NODE_SPACING + 60, 220);

  // Map node id → SVG coordinates
  const coordMap = new Map<string, { x: number; y: number }>();
  const allLayerGroups = [
    { layer: 'Pearl',     ns: pearlNodes },
    { layer: 'Eblit',     ns: eblitNodes },
    { layer: 'Substrace', ns: subNodes },
    { layer: 'Quilt',     ns: quiltNodes },
  ];
  allLayerGroups.forEach(({ layer, ns }) => {
    const cfg = LAYER_CFG[layer];
    ns.forEach((n, i) => {
      coordMap.set(n.id, {
        x: cfg.x,
        y: PIPELINE_TOP + i * NODE_SPACING + NODE_R,
      });
    });
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(251,113,133,0.2)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', marginBottom: 2 }}>
          Substrace Theorem · SVG Pipeline Proof
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Pearl → Eblit → Substrace → Quilt · Same inputs = same SIDs at any independent endpoint
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {/* Demo button */}
        <button
          onClick={runTenPearlRoundtrip}
          disabled={running}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: 10,
            background: running ? 'rgba(100,116,139,0.06)' : 'rgba(251,113,133,0.12)',
            border: `1px solid ${running ? 'rgba(100,116,139,0.2)' : 'rgba(251,113,133,0.4)'}`,
            borderRadius: 6, color: running ? '#475569' : '#fb7185',
            fontSize: 11, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
          }}
        >
          {running ? <>⟳ Running 10-Pearl Roundtrip…</> : <>🧪 10-Pearl Roundtrip Demo · Substrace Theorem Proof</>}
        </button>

        {/* SID equality banner */}
        {roundtripResult && (
          <div style={{
            marginBottom: 10, padding: '8px 12px',
            background: roundtripResult.sid_equality ? 'rgba(110,231,183,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${roundtripResult.sid_equality ? 'rgba(110,231,183,0.35)' : 'rgba(239,68,68,0.35)'}`,
            borderRadius: 7,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: roundtripResult.sid_equality ? '#6ee7b7' : '#f87171', marginBottom: 3 }}>
              {roundtripResult.sid_equality
                ? '✓ SID EQUALITY CONFIRMED — Substrace Theorem holds'
                : '✗ SID MISMATCH — Theorem violated (unexpected)'}
            </div>
            <div style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.7 }}>
              <span>Substrace: </span><span style={{ color: '#a78bfa' }}>{roundtripResult.substrace.substrace_id}</span>
              <br />
              <span>Quilt: </span><span style={{ color: '#fb7185' }}>{roundtripResult.quilt.quilt_id}</span>
            </div>
          </div>
        )}

        {/* ── SVG Pipeline ─────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(10,15,26,0.6)', border: '1px solid rgba(100,116,139,0.15)',
          borderRadius: 8, marginBottom: 12, overflowX: 'auto',
        }}>
          <svg width={SVG_W} height={svgH} style={{ display: 'block' }}>
            <ArrowMarker />

            {/* Layer header labels */}
            {LAYER_ORDER.map((layer) => {
              const cfg = LAYER_CFG[layer];
              return (
                <g key={`lbl-${layer}`}>
                  <text x={cfg.x} y={28} textAnchor="middle" fill={cfg.color} fontSize={10} fontWeight="700">
                    {cfg.icon} {cfg.label}
                  </text>
                  <text x={cfg.x} y={42} textAnchor="middle" fill="#475569" fontSize={7}>
                    {cfg.desc}
                  </text>
                  {/* Column divider */}
                  <line x1={cfg.x} y1={52} x2={cfg.x} y2={svgH - 20}
                    stroke={cfg.stroke} strokeWidth={1} strokeDasharray="3,4" opacity={0.2} />
                </g>
              );
            })}

            {/* Connector arrows — Pearl→Eblit (1:1 by index) */}
            {pearlNodes.map((pn, i) => {
              const pc = coordMap.get(pn.id);
              const en = eblitNodes[i];
              if (!pc || !en) return null;
              const ec = coordMap.get(en.id);
              if (!ec) return null;
              return (
                <line key={`pe-${i}`}
                  x1={pc.x + NODE_R} y1={pc.y}
                  x2={ec.x - NODE_R - 6} y2={ec.y}
                  stroke="rgba(110,231,183,0.35)" strokeWidth={1}
                  markerEnd="url(#arrow-green)"
                />
              );
            })}

            {/* Connector arrows — Eblit→Substrace (N:1 fan-in) */}
            {subNodes.map((sn) => {
              const sc = coordMap.get(sn.id);
              if (!sc) return null;
              return eblitNodes.map((en, i) => {
                const ec = coordMap.get(en.id);
                if (!ec) return null;
                return (
                  <line key={`es-${i}`}
                    x1={ec.x + NODE_R} y1={ec.y}
                    x2={sc.x - NODE_R - 6} y2={sc.y}
                    stroke="rgba(251,191,36,0.25)" strokeWidth={1}
                    markerEnd="url(#arrow-yellow)"
                  />
                );
              });
            })}

            {/* Connector arrows — Substrace→Quilt (N:1) */}
            {quiltNodes.map((qn) => {
              const qc = coordMap.get(qn.id);
              if (!qc) return null;
              return subNodes.map((sn, i) => {
                const sc = coordMap.get(sn.id);
                if (!sc) return null;
                return (
                  <line key={`sq-${i}`}
                    x1={sc.x + NODE_R} y1={sc.y}
                    x2={qc.x - NODE_R - 6} y2={qc.y}
                    stroke="rgba(167,139,250,0.35)" strokeWidth={1}
                    markerEnd="url(#arrow-purple)"
                  />
                );
              });
            })}

            {/* Nodes */}
            {allLayerGroups.flatMap(({ layer, ns }) =>
              ns.map((n, i) => {
                const cfg = LAYER_CFG[layer];
                const c = coordMap.get(n.id);
                if (!c) return null;
                const isSelected = selectedSid === n.id;
                const isAnimating = animating === layer;
                return (
                  <g key={`node-${n.id}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedSid(n.id); setSidInput(n.id); }}
                    role="button"
                    aria-label={`Select SID ${n.id}`}
                  >
                    <circle
                      cx={c.x} cy={c.y} r={NODE_R}
                      fill={isSelected ? cfg.fill : 'rgba(10,15,26,0.8)'}
                      stroke={isSelected ? cfg.color : cfg.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={isAnimating ? 0.6 : 1}
                      style={{ transition: 'all 0.3s ease' }}
                    />
                    <text x={c.x} y={c.y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={12} style={{ pointerEvents: 'none' }}>
                      {cfg.icon}
                    </text>
                    <text x={c.x} y={c.y + NODE_R + 10} textAnchor="middle"
                      fill={cfg.color} fontSize={6} fontFamily="monospace"
                      style={{ pointerEvents: 'none' }}>
                      {n.id.slice(0, 8)}…
                    </text>
                    {isSelected && (
                      <circle cx={c.x} cy={c.y} r={NODE_R + 4}
                        fill="none" stroke={cfg.color} strokeWidth={1}
                        strokeDasharray="4,3" opacity={0.7}
                        style={{ animation: 'none' }}
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* Empty state labels when no nodes */}
            {nodes.length === 0 && LAYER_ORDER.map((layer) => {
              const cfg = LAYER_CFG[layer];
              return (
                <text key={`empty-${layer}`} x={cfg.x} y={PIPELINE_TOP + 40}
                  textAnchor="middle" fill="rgba(100,116,139,0.3)" fontSize={8}>
                  —
                </text>
              );
            })}
          </svg>
        </div>

        {/* SID Verify box */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Verify a SID — click any node above or enter manually
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={sidInput}
              onChange={(e) => setSidInput(e.target.value)}
              placeholder="32-char soccerball SID"
              style={{
                flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 5, color: '#e2e8f0', fontSize: 9, padding: '5px 8px', fontFamily: 'monospace',
              }}
            />
            <button
              onClick={verifySid}
              disabled={!sidInput.trim() && !selectedSid}
              style={{
                padding: '5px 12px', background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.35)', borderRadius: 5,
                color: '#a78bfa', fontSize: 9, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Verify
            </button>
          </div>
          {verifyResult && (
            <div style={{
              marginTop: 6, padding: '6px 8px',
              background: verifyResult.found ? 'rgba(110,231,183,0.06)' : 'rgba(100,116,139,0.06)',
              border: `1px solid ${verifyResult.found ? 'rgba(110,231,183,0.25)' : 'rgba(100,116,139,0.15)'}`,
              borderRadius: 5, fontSize: 9,
            }}>
              <span style={{ color: verifyResult.found ? '#6ee7b7' : '#475569', fontWeight: 700 }}>
                {verifyResult.found ? '✓ Found in BETWEEN crystal' : '○ Not in session crystal'}
              </span>
              <span style={{ color: '#334155', marginLeft: 6, fontFamily: 'monospace' }}>
                {verifyResult.sid.slice(0, 20)}…
              </span>
            </div>
          )}
        </div>

        {/* Selected node detail */}
        {selectedSid && (
          <div style={{
            padding: '8px 10px', background: 'rgba(15,17,26,0.6)',
            border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, fontSize: 9,
          }}>
            <div style={{ color: '#94a3b8', marginBottom: 3, fontWeight: 600 }}>Selected SID</div>
            <div style={{ fontFamily: 'monospace', color: '#e2e8f0', wordBreak: 'break-all' }}>
              {selectedSid}
            </div>
            {nodes.find((n) => n.id === selectedSid)?.extra && (
              <div style={{ color: '#475569', fontFamily: 'monospace', marginTop: 4, lineHeight: 1.6 }}>
                {Object.entries(nodes.find((n) => n.id === selectedSid)!.extra!).map(([k, v]) => (
                  <div key={k}><span style={{ color: '#64748b' }}>{k}:</span> {String(v)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
