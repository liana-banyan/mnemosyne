// SubstraceViz — BP060 Application 002 Step 1 · UI-6
// Pearl → Eblit → Substrace → Quilt pipeline visualization.
// Visual proof of the Substrace Theorem in member-facing UI.
// Click a SID to verify it. "10-Pearl Roundtrip Demo" button.
// Per canon_substrace_theorem_application_series_001_bp059.
// NEVER uses "wormhole" — binding discipline.

import React, { useState, useCallback } from 'react';

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

// ─── Pipeline diagram ─────────────────────────────────────────────────────────

const LAYER_META: Record<string, { color: string; bg: string; border: string; icon: string; desc: string }> = {
  Pearl:    { color: '#6ee7b7', bg: 'rgba(110,231,183,0.08)', border: 'rgba(110,231,183,0.3)', icon: '🪶', desc: 'Atomic wire-non-atomic-meaning data primitive' },
  Eblit:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  icon: '⚡', desc: 'Blink-emit moment trace · BETWEEN decay class' },
  Substrace:{ color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', icon: '🕸', desc: 'Substrate-lace · N Eblit null_lines woven into aftereffect-pattern' },
  Quilt:    { color: '#fb7185', bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.3)', icon: '🛡', desc: 'Kipling Effect artifact · N Substrace sheets composed via Soccerball' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SubstraceViz() {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ sid: string; found: boolean; data?: unknown } | null>(null);
  const [roundtripResult, setRoundtripResult] = useState<RoundtripResult | null>(null);
  const [sidInput, setSidInput] = useState('');

  const runTenPearlRoundtrip = useCallback(async () => {
    setRunning(true);
    setNodes([]);
    setRoundtripResult(null);

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

      // Build pipeline nodes
      const newNodes: PipelineNode[] = [
        // 10 Pearls
        ...r.pearls.map((p, i) => ({
          layer: 'Pearl' as const,
          id: p,
          ts: r.ts + i,
          extra: { idx: String(i) },
        })),
        // 10 Eblits
        ...r.eblits.map((e) => ({
          layer: 'Eblit' as const,
          id: e.eblit_id,
          parent_ids: [e.pearl_id],
          ts: r.ts + 10,
          extra: { null_line: e.null_line, decay: e.decay_class },
        })),
        // 1 Substrace
        {
          layer: 'Substrace' as const,
          id: r.substrace.substrace_id,
          parent_ids: r.substrace.eblits,
          ts: r.ts + 20,
          extra: { decay: r.substrace.decay_class },
        },
        // 1 Quilt
        {
          layer: 'Quilt' as const,
          id: r.quilt.quilt_id,
          parent_ids: r.quilt.substraces,
          ts: r.ts + 21,
          extra: { tag: r.quilt.narrative_tag, decay: r.quilt.decay_class },
        },
      ];
      setNodes(newNodes);
    } catch (err) {
      console.error('[SubstraceViz] ten_pearl_roundtrip error:', err);
    } finally {
      setRunning(false);
    }
  }, []);

  const verifySid = useCallback(async () => {
    const sid = sidInput.trim() || selectedSid;
    if (!sid) return;
    const ct = window.amplify?.caithedralTools;
    if (!ct) return;
    const res = await ct.soccerball_lookup(sid);
    setVerifyResult({
      sid,
      found: !!(res.ok && res.result),
      data: res.result,
    });
  }, [sidInput, selectedSid]);

  const layerNodes = (layer: string) => nodes.filter((n) => n.layer === layer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px 6px',
        borderBottom: '1px solid rgba(251,113,133,0.2)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', marginBottom: 2 }}>
          Substrace Theorem · Visual Proof
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Pearl → Eblit → Substrace → Quilt · Same inputs = same SIDs at any independent endpoint
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {/* Pipeline diagram (always shown) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: '10px',
          background: 'rgba(15,17,26,0.5)',
          border: '1px solid rgba(100,116,139,0.15)',
          borderRadius: 8,
          overflow: 'auto',
        }}>
          {(['Pearl', 'Eblit', 'Substrace', 'Quilt'] as const).map((layer, idx) => {
            const meta = LAYER_META[layer];
            const count = layerNodes(layer).length;
            return (
              <React.Fragment key={layer}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 80,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: meta.bg, border: `2px solid ${meta.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: meta.color }}>{layer}</div>
                  <div style={{ fontSize: 8, color: '#334155', textAlign: 'center', maxWidth: 80, lineHeight: 1.3 }}>
                    {meta.desc.slice(0, 30)}…
                  </div>
                  {count > 0 && (
                    <div style={{
                      fontSize: 8, background: meta.bg, border: `1px solid ${meta.border}`,
                      color: meta.color, borderRadius: 8, padding: '1px 6px', fontWeight: 700,
                    }}>
                      {count}
                    </div>
                  )}
                </div>
                {idx < 3 && (
                  <div style={{ color: '#334155', fontSize: 16, flexShrink: 0, margin: '0 4px' }}>→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 10-Pearl Roundtrip Demo button */}
        <button
          onClick={runTenPearlRoundtrip}
          disabled={running}
          style={{
            width: '100%',
            padding: '10px 14px',
            marginBottom: 10,
            background: running ? 'rgba(100,116,139,0.06)' : 'rgba(251,113,133,0.12)',
            border: `1px solid ${running ? 'rgba(100,116,139,0.2)' : 'rgba(251,113,133,0.4)'}`,
            borderRadius: 6,
            color: running ? '#475569' : '#fb7185',
            fontSize: 11,
            fontWeight: 700,
            cursor: running ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
        >
          {running ? (
            <>⟳ Running 10-Pearl Roundtrip…</>
          ) : (
            <>🧪 10-Pearl Roundtrip Demo · Substrace Theorem Proof</>
          )}
        </button>

        {/* Roundtrip result summary */}
        {roundtripResult && (
          <div style={{
            marginBottom: 12, padding: '10px 12px',
            background: roundtripResult.sid_equality ? 'rgba(110,231,183,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${roundtripResult.sid_equality ? 'rgba(110,231,183,0.35)' : 'rgba(239,68,68,0.35)'}`,
            borderRadius: 7,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: roundtripResult.sid_equality ? '#6ee7b7' : '#f87171', marginBottom: 4 }}>
              {roundtripResult.sid_equality
                ? '✓ SID EQUALITY CONFIRMED — Substrace Theorem holds'
                : '✗ SID MISMATCH — Theorem violated (unexpected)'}
            </div>
            <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.7, fontFamily: 'monospace' }}>
              <div>10 Pearls emitted · 10 Eblits · 1 Substrace · 1 Quilt</div>
              <div>Quilt SID: <span style={{ color: '#fb7185' }}>{roundtripResult.quilt.quilt_id}</span></div>
              <div>Substrace SID: <span style={{ color: '#a78bfa' }}>{roundtripResult.substrace.substrace_id}</span></div>
              <div>decay_class: BETWEEN on all emissions</div>
            </div>
          </div>
        )}

        {/* SID Verify */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Verify a SID — click any SID above or enter one manually
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={sidInput}
              onChange={(e) => setSidInput(e.target.value)}
              placeholder="32-char soccerball SID to verify"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 5,
                color: '#e2e8f0',
                fontSize: 9,
                padding: '5px 8px',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={verifySid}
              disabled={!sidInput.trim() && !selectedSid}
              style={{
                padding: '5px 12px',
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.35)',
                borderRadius: 5,
                color: '#a78bfa',
                fontSize: 9,
                fontWeight: 700,
                cursor: 'pointer',
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
                {verifyResult.found ? '✓ Found in BETWEEN crystal' : '○ Not in session crystal (may be in historical substrate)'}
              </span>
              <span style={{ color: '#334155', marginLeft: 6, fontFamily: 'monospace' }}>{verifyResult.sid}</span>
            </div>
          )}
        </div>

        {/* Node list — scrollable, grouped by layer */}
        {nodes.length > 0 && (
          <div>
            {(['Pearl', 'Eblit', 'Substrace', 'Quilt'] as const).map((layer) => {
              const layerN = layerNodes(layer);
              if (layerN.length === 0) return null;
              const meta = LAYER_META[layer];
              return (
                <div key={layer} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: meta.color, marginBottom: 4 }}>
                    {meta.icon} {layer} Layer ({layerN.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {layerN.map((n, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedSid(n.id);
                          setSidInput(n.id);
                        }}
                        title={`Click to select SID: ${n.id}`}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: 'left',
                          background: selectedSid === n.id ? meta.bg : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selectedSid === n.id ? meta.border : 'rgba(100,116,139,0.1)'}`,
                          borderRadius: 5, padding: '5px 7px', cursor: 'pointer',
                          transition: 'all 0.1s',
                        }}
                      >
                        <span style={{ fontSize: 8, fontWeight: 700, color: meta.color, fontFamily: 'monospace', flexShrink: 0 }}>
                          {n.id.slice(0, 16)}…
                        </span>
                        {n.extra && Object.keys(n.extra).length > 0 && (
                          <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                            {Object.entries(n.extra).map(([k, v]) => `${k}:${String(v).slice(0, 12)}`).join(' · ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubstraceViz;
