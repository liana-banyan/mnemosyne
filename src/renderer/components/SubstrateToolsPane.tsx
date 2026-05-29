// SubstrateToolsPane — BP060 Application 002 Step 1 · UI-1
// Member-facing surface for 9 caithedral-core@0.2.0 substrate operations.
// soccerball_emit/decode/lookup · speckle_nibble · eblit_emit
// substrace_weave · quilt_compose · substrate_address_emit/validate
// decay_class: BETWEEN on all new emissions.

import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolId =
  | 'soccerball_emit'
  | 'soccerball_decode'
  | 'soccerball_lookup'
  | 'speckle_nibble'
  | 'eblit_emit'
  | 'substrace_weave'
  | 'quilt_compose'
  | 'substrate_address_emit'
  | 'substrate_address_validate';

interface ToolResult {
  tool: ToolId;
  result: unknown;
  error?: string;
  ts: number;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Array<{
  id: ToolId;
  label: string;
  description: string;
  tier: 'soccerball' | 'eblit' | 'substrace' | 'quilt' | 'address';
  fields: Array<{ key: string; placeholder: string; multiline?: boolean }>;
}> = [
  {
    id: 'soccerball_emit',
    label: 'soccerball_emit',
    description: 'Encode N pearl_ids into a 32-char content-addressed Soccerball SID.',
    tier: 'soccerball',
    fields: [
      { key: 'pearls', placeholder: 'pearl_id1, pearl_id2, ...', multiline: true },
      { key: 'bindings', placeholder: '{"key":"value"} (optional)' },
    ],
  },
  {
    id: 'soccerball_decode',
    label: 'soccerball_decode',
    description: 'Decode a Soccerball SID back to its constituent pearls + bindings.',
    tier: 'soccerball',
    fields: [{ key: 'sid', placeholder: '32-char soccerball_id' }],
  },
  {
    id: 'soccerball_lookup',
    label: 'soccerball_lookup',
    description: 'O(1) wire-format lookup of a Soccerball SID. Returns full PeanutRoll.',
    tier: 'soccerball',
    fields: [{ key: 'sid', placeholder: '32-char soccerball_id' }],
  },
  {
    id: 'speckle_nibble',
    label: 'speckle_nibble',
    description: 'Extract a single 4-bit Speckle nibble at position 0–31 of a Soccerball SID.',
    tier: 'soccerball',
    fields: [
      { key: 'sid', placeholder: '32-char soccerball_id' },
      { key: 'position', placeholder: 'position (0–31)' },
    ],
  },
  {
    id: 'eblit_emit',
    label: 'eblit_emit',
    description: 'Capture the emission-moment trace for a Pearl. Creates BETWEEN-class Eblit.',
    tier: 'eblit',
    fields: [
      { key: 'pearl_id', placeholder: 'pearl_id (any string)' },
      { key: 'source_cathedral', placeholder: 'source_cathedral (e.g. mnemosyne-ui)' },
    ],
  },
  {
    id: 'substrace_weave',
    label: 'substrace_weave',
    description: 'Weave N Eblit null_lines into a Substrace sheet. Core Substrace Theorem operation.',
    tier: 'substrace',
    fields: [
      { key: 'null_lines', placeholder: 'null_line1, null_line2, ...', multiline: true },
      { key: 'weaver', placeholder: 'weaver identifier (e.g. mnemosyne-ui)' },
    ],
  },
  {
    id: 'quilt_compose',
    label: 'quilt_compose',
    description: 'Compose N Substrace SIDs into a QuiltOfSubstrace — the Kipling Effect artifact.',
    tier: 'quilt',
    fields: [
      { key: 'substrace_ids', placeholder: 'substrace_id1, substrace_id2, ...', multiline: true },
      { key: 'narrative_tag', placeholder: 'narrative tag (e.g. my-quilt-story)' },
      { key: 'weaver', placeholder: 'weaver identifier' },
    ],
  },
  {
    id: 'substrate_address_emit',
    label: 'substrate_address_emit',
    description: 'Assemble a 216-bit 9-hex-fence substrate coordinate address from a seed string.',
    tier: 'address',
    fields: [{ key: 'seed', placeholder: 'seed string (any content-addressable input)' }],
  },
  {
    id: 'substrate_address_validate',
    label: 'substrate_address_validate',
    description: 'Validate a 216-bit substrate address. Checks all 6 thorax-parity handshakes.',
    tier: 'address',
    fields: [{ key: 'address', placeholder: '54 lowercase hex chars (216-bit address)' }],
  },
];

const TIER_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  soccerball: { bg: 'rgba(110,231,183,0.08)', border: 'rgba(110,231,183,0.3)', label: '#6ee7b7' },
  eblit:      { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  label: '#fbbf24' },
  substrace:  { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', label: '#a78bfa' },
  quilt:      { bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.3)', label: '#fb7185' },
  address:    { bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.3)',  label: '#38bdf8' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SubstrateToolsPane() {
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<ToolResult[]>([]);
  const [running, setRunning] = useState<ToolId | null>(null);

  const setField = useCallback((toolId: ToolId, field: string, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [toolId]: { ...prev[toolId], [field]: value },
    }));
  }, []);

  const runTool = useCallback(async (tool: typeof TOOLS[0]) => {
    const vals = inputs[tool.id] ?? {};
    const ct = window.amplify?.caithedralTools;
    if (!ct) {
      setResults((r) => [
        { tool: tool.id, result: null, error: 'Caithedral IPC not available (dev mode?)', ts: Date.now() },
        ...r,
      ]);
      return;
    }

    setRunning(tool.id);
    try {
      let res: unknown;

      if (tool.id === 'soccerball_emit') {
        const pearls = (vals.pearls ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        let bindings: Record<string, string> | undefined;
        if (vals.bindings?.trim()) {
          try { bindings = JSON.parse(vals.bindings); } catch { /* ignore */ }
        }
        res = await ct.soccerball_emit(pearls, bindings);
      } else if (tool.id === 'soccerball_decode') {
        res = await ct.soccerball_decode(vals.sid ?? '');
      } else if (tool.id === 'soccerball_lookup') {
        res = await ct.soccerball_lookup(vals.sid ?? '');
      } else if (tool.id === 'speckle_nibble') {
        res = await ct.speckle_nibble(vals.sid ?? '', parseInt(vals.position ?? '0', 10));
      } else if (tool.id === 'eblit_emit') {
        res = await ct.eblit_emit(vals.pearl_id ?? '', vals.source_cathedral ?? 'mnemosyne-ui');
      } else if (tool.id === 'substrace_weave') {
        const null_lines = (vals.null_lines ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        res = await ct.substrace_weave(null_lines, vals.weaver ?? 'mnemosyne-ui');
      } else if (tool.id === 'quilt_compose') {
        const substrace_ids = (vals.substrace_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        res = await ct.quilt_compose(substrace_ids, vals.narrative_tag ?? 'my-quilt', vals.weaver ?? 'mnemosyne-ui');
      } else if (tool.id === 'substrate_address_emit') {
        res = await ct.substrate_address_emit(vals.seed ?? '');
      } else if (tool.id === 'substrate_address_validate') {
        res = await ct.substrate_address_validate(vals.address ?? '');
      }

      setResults((r) => [{ tool: tool.id, result: res, ts: Date.now() }, ...r.slice(0, 19)]);
    } catch (err) {
      setResults((r) => [{ tool: tool.id, result: null, error: String(err), ts: Date.now() }, ...r.slice(0, 19)]);
    } finally {
      setRunning(null);
    }
  }, [inputs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px 6px',
        borderBottom: '1px solid rgba(110,231,183,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginBottom: 2 }}>
          Substrate Tools · caithedral-core@0.2.0
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Pearl → Eblit → Substrace → Quilt pipeline · decay_class: BETWEEN · Application 002 Step 1
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Tool list */}
        <div style={{
          width: 340,
          flexShrink: 0,
          overflow: 'auto',
          borderRight: '1px solid rgba(100,116,139,0.15)',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {TOOLS.map((tool) => {
            const tc = TIER_COLORS[tool.tier];
            return (
              <div
                key={tool.id}
                style={{
                  background: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: 7,
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: tc.label, marginBottom: 3, fontFamily: 'monospace' }}>
                  {tool.label}
                </div>
                <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }}>
                  {tool.description}
                </div>
                {tool.fields.map((f) => (
                  <div key={f.key} style={{ marginBottom: 4 }}>
                    {f.multiline ? (
                      <textarea
                        value={inputs[tool.id]?.[f.key] ?? ''}
                        onChange={(e) => setField(tool.id, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={2}
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(100,116,139,0.2)',
                          borderRadius: 4,
                          color: '#e2e8f0',
                          fontSize: 9,
                          padding: '4px 6px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : (
                      <input
                        value={inputs[tool.id]?.[f.key] ?? ''}
                        onChange={(e) => setField(tool.id, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(100,116,139,0.2)',
                          borderRadius: 4,
                          color: '#e2e8f0',
                          fontSize: 9,
                          padding: '4px 6px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => runTool(tool)}
                  disabled={running === tool.id}
                  style={{
                    marginTop: 2,
                    padding: '4px 12px',
                    background: running === tool.id ? 'rgba(100,116,139,0.1)' : tc.bg,
                    border: `1px solid ${tc.border}`,
                    borderRadius: 4,
                    color: running === tool.id ? '#475569' : tc.label,
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: running === tool.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  {running === tool.id ? 'Running…' : 'Run'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Results pane */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Results ({results.length})
          </div>
          {results.length === 0 && (
            <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', padding: 8 }}>
              Run a tool to see results here. All emissions use decay_class: BETWEEN.
            </div>
          )}
          {results.map((r, i) => {
            const tc = TIER_COLORS[TOOLS.find((t) => t.id === r.tool)?.tier ?? 'soccerball'];
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  background: r.error ? 'rgba(239,68,68,0.06)' : tc.bg,
                  border: `1px solid ${r.error ? 'rgba(239,68,68,0.3)' : tc.border}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: r.error ? '#f87171' : tc.label, fontFamily: 'monospace' }}>
                    {r.tool}
                  </span>
                  <span style={{ fontSize: 8, color: '#334155' }}>
                    {new Date(r.ts).toISOString().slice(11, 23)}Z
                  </span>
                </div>
                {r.error ? (
                  <div style={{ fontSize: 9, color: '#f87171', fontFamily: 'monospace' }}>{r.error}</div>
                ) : (
                  <pre style={{
                    fontSize: 9,
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}>
                    {JSON.stringify(r.result, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SubstrateToolsPane;
